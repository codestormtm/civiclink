const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { pool } = require("../config/db");
const env = require("../config/env");
const {
  isFirebaseAuthEnabled,
  verifyFirebaseIdToken,
} = require("../config/firebaseAdmin");
const { minioClient, bucketName: BUCKET } = require("../config/minio");
const ROLES = require("../constants/roles");
const { ensureFirebaseAuthSchema } = require("../services/firebaseAuthSchemaService");
const { ensurePasswordResetSchema } = require("../services/passwordResetService");
const { ensureUserPreferencesSchema } = require("../services/userPreferencesSchemaService");
const { success, failure } = require("../utils/response");

const JWT_SECRET = env.jwt.secret;
const MINIO_URL = process.env.MINIO_URL || "http://localhost:9000";
const ADMIN_PORTAL_ROLES = [ROLES.SYSTEM_ADMIN, ROLES.DEPT_ADMIN];
const WORKER_PORTAL_ROLES = [ROLES.WORKER];
const INVALID_LOGIN_MESSAGE = "Invalid email or password";
const DUMMY_PASSWORD_HASH = "$2b$10$5fRvw5iIPQxjM0M1VYx5UuV3z7i0rGUNShUMHbOWcZH/5Li.yYI8e";
const SUPPORTED_LANGUAGES = new Set(["en", "si", "ta"]);

function normalizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function buildUnsupportedForgotPasswordResponse() {
  return {
    flow: "UNSUPPORTED",
    eligible: false,
    message: "Forgot password is not available for this account.",
  };
}

function buildSessionPayload(user) {
  const token = jwt.sign(
    { id: user.id, role: user.role, department_id: user.department_id },
    JWT_SECRET,
    { expiresIn: env.jwt.expiresIn }
  );

  return {
    token,
    role: user.role,
    name: user.name,
    department_id: user.department_id,
    department_name: user.department_name,
    preferred_language: user.preferred_language || null,
  };
}

function buildProfilePayload(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    department_id: user.department_id,
    department_name: user.department_name || null,
    preferred_language: user.preferred_language || null,
  };
}

function normalizePreferredLanguage(value) {
  if (value == null || value === "") {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  return SUPPORTED_LANGUAGES.has(normalized) ? normalized : null;
}

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeFirebaseProvider(decodedToken) {
  const provider = decodedToken?.firebase?.sign_in_provider;

  if (provider === "password") {
    return "password";
  }

  if (provider === "google.com") {
    return "google";
  }

  return null;
}

function deriveCitizenName(decodedToken) {
  const displayName = String(decodedToken?.name || "").trim();

  if (displayName) {
    return displayName;
  }

  const email = String(decodedToken?.email || "").trim();
  if (email.includes("@")) {
    return email.split("@")[0];
  }

  return "Citizen";
}

async function findUserForSession(client, clause, value) {
  const result = await client.query(
    `SELECT u.id,
            u.name,
            u.email,
            u.password_hash,
            u.role,
            u.department_id,
            u.is_active,
            u.firebase_uid,
            u.auth_source,
            u.auth_provider,
            u.email_verified_at,
            u.preferred_language,
            d.name AS department_name
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     WHERE ${clause}
     LIMIT 1`,
    [value]
  );

  return result.rows[0] || null;
}

async function authenticateLocalUser(email, password) {
  if (!email || !password) {
    throw createHttpError("email and password are required", 400);
  }

  const result = await pool.query(
    `SELECT u.id,
            u.name,
            u.email,
            u.password_hash,
            u.role,
            u.department_id,
            u.is_active,
            u.auth_source,
            u.preferred_language,
            d.name AS department_name
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     WHERE LOWER(u.email) = LOWER($1)
     LIMIT 1`,
    [String(email).trim()]
  );

  if (result.rows.length === 0) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    throw createHttpError(INVALID_LOGIN_MESSAGE, 401);
  }

  const user = result.rows[0];

  if (!user.is_active) {
    throw createHttpError("User account is inactive", 403);
  }

  if (user.auth_source === "FIREBASE" || !user.password_hash) {
    throw createHttpError("This account uses Firebase sign-in.", 400);
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);

  if (!isMatch) {
    throw createHttpError(INVALID_LOGIN_MESSAGE, 401);
  }

  return user;
}

function assertPortalAccess(user, allowedRoles, portal) {
  if (allowedRoles.includes(user.role)) {
    return;
  }

  if (user.role === ROLES.WORKER) {
    throw createHttpError("Worker accounts must sign in through the worker portal.", 403);
  }

  if (user.role === ROLES.CITIZEN) {
    throw createHttpError("Citizen accounts must sign in through the public portal.", 403);
  }

  if (portal === "worker") {
    throw createHttpError("Admin accounts must sign in through the admin portal.", 403);
  }

  throw createHttpError("This account cannot sign in to this portal.", 403);
}

async function upsertCitizenFromFirebase(client, identity) {
  const emailVerifiedAt = identity.emailVerified ? new Date() : null;
  const firebaseUser = await findUserForSession(client, "u.firebase_uid = $1", identity.firebaseUid);

  if (firebaseUser) {
    if (firebaseUser.role !== ROLES.CITIZEN) {
      throw createHttpError("This email is already assigned to an internal CivicLink account.", 409);
    }

    if (!firebaseUser.is_active) {
      throw createHttpError("User account is inactive", 403);
    }

    const updatedResult = await client.query(
      `UPDATE users
       SET email = $2,
           auth_source = 'FIREBASE',
           auth_provider = $3,
           email_verified_at = CASE
             WHEN $4::timestamptz IS NULL THEN email_verified_at
             ELSE $4::timestamptz
           END,
           preferred_language = CASE
             WHEN preferred_language IS NULL AND $5::varchar IS NOT NULL THEN $5::varchar
             ELSE preferred_language
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, email, role, department_id, is_active, preferred_language`,
      [
        firebaseUser.id,
        identity.email,
        identity.authProvider,
        emailVerifiedAt,
        identity.preferredLanguage,
      ]
    );

    return {
      ...updatedResult.rows[0],
      department_name: firebaseUser.department_name,
    };
  }

  const emailUser = await findUserForSession(client, "LOWER(u.email) = LOWER($1)", identity.email);

  if (emailUser) {
    if (emailUser.role !== ROLES.CITIZEN) {
      throw createHttpError("This email is already assigned to an internal CivicLink account.", 409);
    }

    if (!emailUser.is_active) {
      throw createHttpError("User account is inactive", 403);
    }

    if (emailUser.auth_source === "FIREBASE" && emailUser.firebase_uid !== identity.firebaseUid) {
      throw createHttpError("This email is already linked to another Firebase account.", 409);
    }

    const updatedResult = await client.query(
      `UPDATE users
       SET firebase_uid = $2,
           auth_source = 'FIREBASE',
           auth_provider = $3,
           email_verified_at = CASE
             WHEN $4::timestamptz IS NULL THEN email_verified_at
             ELSE $4::timestamptz
           END,
           preferred_language = CASE
             WHEN preferred_language IS NULL AND $5::varchar IS NOT NULL THEN $5::varchar
             ELSE preferred_language
           END,
           password_hash = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, email, role, department_id, is_active, preferred_language`,
      [
        emailUser.id,
        identity.firebaseUid,
        identity.authProvider,
        emailVerifiedAt,
        identity.preferredLanguage,
      ]
    );

    return {
      ...updatedResult.rows[0],
      department_name: emailUser.department_name,
    };
  }

  const createdResult = await client.query(
    `INSERT INTO users (
       name,
       email,
       password_hash,
       role,
       firebase_uid,
       auth_provider,
       auth_source,
       email_verified_at,
       preferred_language
     )
     VALUES ($1, $2, NULL, $3, $4, $5, 'FIREBASE', $6, $7)
     RETURNING id, name, email, role, department_id, is_active, preferred_language`,
    [
      identity.name,
      identity.email,
      ROLES.CITIZEN,
      identity.firebaseUid,
      identity.authProvider,
      emailVerifiedAt,
      identity.preferredLanguage,
    ]
  );

  return {
    ...createdResult.rows[0],
    department_name: null,
  };
}

exports.register = async (req, res) => {
  const { name, email, password, preferred_language: preferredLanguageInput } = req.body;
  const preferredLanguage = normalizePreferredLanguage(preferredLanguageInput);

  if (!name || !email || !password) {
    return failure(res, "name, email, and password are required", 400);
  }

  if (preferredLanguageInput != null && !preferredLanguage) {
    return failure(res, "preferred_language must be one of en, si, or ta", 400);
  }

  try {
    await ensureUserPreferencesSchema();
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, preferred_language)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, preferred_language`,
      [name, email, hashedPassword, ROLES.CITIZEN, preferredLanguage]
    );

    return success(res, result.rows[0], 201);
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await authenticateLocalUser(email, password);
    assertPortalAccess(user, ADMIN_PORTAL_ROLES, "admin");

    res.json(buildSessionPayload(user));
  } catch (err) {
    return failure(res, err.message, err.statusCode || 500);
  }
};

exports.workerLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await authenticateLocalUser(email, password);
    assertPortalAccess(user, WORKER_PORTAL_ROLES, "worker");

    return res.json(buildSessionPayload(user));
  } catch (err) {
    return failure(res, err.message, err.statusCode || 500);
  }
};

exports.createFirebaseSession = async (req, res) => {
  const { idToken, preferred_language: preferredLanguageInput } = req.body || {};
  const preferredLanguage = normalizePreferredLanguage(preferredLanguageInput);

  if (!idToken || !String(idToken).trim()) {
    return failure(res, "idToken is required", 400);
  }

  if (preferredLanguageInput != null && !preferredLanguage) {
    return failure(res, "preferred_language must be one of en, si, or ta", 400);
  }

  if (!isFirebaseAuthEnabled()) {
    return failure(res, "Firebase citizen authentication is not configured.", 503);
  }

  try {
    await ensureFirebaseAuthSchema();
    await ensureUserPreferencesSchema();
  } catch (err) {
    return failure(res, err.message);
  }

  let decodedToken;

  try {
    decodedToken = await verifyFirebaseIdToken(String(idToken).trim());
  } catch {
    return failure(res, "Invalid Firebase token.", 401);
  }

  const authProvider = normalizeFirebaseProvider(decodedToken);
  const email = String(decodedToken.email || "").trim().toLowerCase();

  if (!decodedToken.uid || !email) {
    return failure(res, "Firebase token must include an email identity.", 400);
  }

  if (!authProvider) {
    return failure(res, "Unsupported Firebase sign-in provider.", 400);
  }

  if (authProvider === "password" && !decodedToken.email_verified) {
    return failure(res, "Please verify your email address before signing in.", 403);
  }

  const client = await pool.connect();

  try {
    const user = await upsertCitizenFromFirebase(client, {
      firebaseUid: decodedToken.uid,
      email,
      name: deriveCitizenName(decodedToken),
      authProvider,
      emailVerified: Boolean(decodedToken.email_verified),
      preferredLanguage,
    });

    return res.json(buildSessionPayload(user));
  } catch (err) {
    return failure(res, err.message, err.statusCode || 500);
  } finally {
    client.release();
  }
};

exports.getCurrentSession = async (req, res) => {
  try {
    await ensureUserPreferencesSchema();
    const user = await findUserForSession(pool, "u.id = $1", req.user.id);

    if (!user || !user.is_active) {
      return failure(res, "User account is inactive", 403);
    }

    return success(res, buildProfilePayload(user), 200, "Session active");
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.updatePreferences = async (req, res) => {
  const preferredLanguage = normalizePreferredLanguage(req.body?.preferred_language);

  if (!preferredLanguage) {
    return failure(res, "preferred_language must be one of en, si, or ta", 400);
  }

  try {
    await ensureUserPreferencesSchema();

    const result = await pool.query(
      `UPDATE users
       SET preferred_language = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, email, role, department_id, preferred_language`,
      [req.user.id, preferredLanguage]
    );

    if (result.rows.length === 0) {
      return failure(res, "User not found", 404);
    }

    const user = await findUserForSession(pool, "u.id = $1", req.user.id);
    return success(res, buildProfilePayload(user), 200, "Preferences updated");
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.lookupForgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email || !String(email).trim()) {
    return failure(res, "email is required", 400);
  }

  try {
    await ensurePasswordResetSchema();

    const result = await pool.query(
      `SELECT u.id,
              u.name,
              u.email,
              u.role,
              u.department_id,
              u.is_active,
              d.name AS department_name,
              d.contact_phone
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE LOWER(u.email) = LOWER($1)
       LIMIT 1`,
      [String(email).trim()]
    );

    if (result.rows.length === 0) {
      return success(res, buildUnsupportedForgotPasswordResponse());
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return success(res, buildUnsupportedForgotPasswordResponse());
    }

    if (user.role === "WORKER") {
      return success(res, {
        flow: "WORKER_CONTACT",
        eligible: true,
        department_name: user.department_name,
        contact_phone: user.contact_phone || "",
        message: user.contact_phone
          ? `Please contact ${user.department_name} using ${user.contact_phone} to reset your password.`
          : `Please contact ${user.department_name} to reset your password.`,
      });
    }

    if (user.role === "DEPT_ADMIN") {
      return success(res, {
        flow: "DEPT_ADMIN_REQUEST",
        eligible: true,
        department_id: user.department_id,
        department_name: user.department_name,
        target_role: user.role,
        message: "Submit the password reset request form for system admin review.",
      });
    }

    return success(res, buildUnsupportedForgotPasswordResponse());
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.createDeptAdminPasswordResetRequest = async (req, res) => {
  const { email, target_name, nic_number, mobile_number, target_role } = req.body;
  const requestLetter = req.file;

  if (!email || !target_name || !nic_number || !mobile_number || !target_role) {
    return failure(
      res,
      "email, target_name, nic_number, mobile_number, and target_role are required",
      400
    );
  }

  if (!requestLetter) {
    return failure(res, "request_letter is required", 400);
  }

  if (target_role !== "DEPT_ADMIN") {
    return failure(res, "Only department admin password reset requests are supported", 400);
  }

  const client = await pool.connect();

  try {
    await ensurePasswordResetSchema();

    const targetResult = await client.query(
      `SELECT u.id,
              u.name,
              u.email,
              u.role,
              u.department_id,
              u.is_active,
              d.name AS department_name
       FROM users u
       JOIN departments d ON d.id = u.department_id
       WHERE LOWER(u.email) = LOWER($1)
       LIMIT 1`,
      [String(email).trim()]
    );

    if (targetResult.rows.length === 0) {
      return failure(res, "No active department admin account matches this email address.", 404);
    }

    const targetUser = targetResult.rows[0];

    if (!targetUser.is_active || targetUser.role !== "DEPT_ADMIN") {
      return failure(res, "No active department admin account matches this email address.", 400);
    }

    if (normalizeName(target_name) !== normalizeName(targetUser.name)) {
      return failure(res, "The submitted name must match the department admin account.", 400);
    }

    const fileName = `password-reset-${Date.now()}-${requestLetter.originalname}`;

    await minioClient.putObject(
      BUCKET,
      fileName,
      requestLetter.buffer,
      requestLetter.size,
      {
        "Content-Type": requestLetter.mimetype,
      }
    );

    const requestLetterUrl = `${MINIO_URL}/${BUCKET}/${fileName}`;

    const insertResult = await client.query(
      `INSERT INTO password_reset_requests (
         department_id,
         target_user_id,
         target_email,
         target_name,
         target_role,
         nic_number,
         mobile_number,
         request_letter_url
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, department_id, target_email, target_name, target_role, status, created_at`,
      [
        targetUser.department_id,
        targetUser.id,
        targetUser.email,
        targetUser.name,
        targetUser.role,
        String(nic_number).trim(),
        String(mobile_number).trim(),
        requestLetterUrl,
      ]
    );

    const createdRequest = insertResult.rows[0];
    const io = req.app.get("io");

    if (io) {
      io.to("role:system_admins").emit("password_reset_request_created", createdRequest);
    }

    return success(
      res,
      {
        ...createdRequest,
        department_name: targetUser.department_name,
      },
      201,
      "Password reset request submitted successfully"
    );
  } catch (err) {
    return failure(res, err.message);
  } finally {
    client.release();
  }
};
