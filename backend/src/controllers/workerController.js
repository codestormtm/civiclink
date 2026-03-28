const { pool } = require("../config/db");
const bcrypt = require("bcrypt");
const { minioClient, bucketName: BUCKET } = require("../config/minio");
const { success, failure } = require("../utils/response");

const MINIO_URL = process.env.MINIO_URL || "http://localhost:9000";
let terminationTableReadyPromise = null;

function ensureWorkerTerminationTableExists() {
  if (!terminationTableReadyPromise) {
    terminationTableReadyPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS worker_termination_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        worker_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
        terminated_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        worker_name_snapshot VARCHAR(150) NOT NULL,
        worker_email_snapshot VARCHAR(255) NOT NULL,
        admin_name_snapshot VARCHAR(150) NOT NULL,
        decision_statement TEXT NOT NULL,
        termination_reason TEXT NOT NULL,
        final_compensation_details TEXT NOT NULL,
        property_return_checklist TEXT NOT NULL,
        letter_body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_worker_termination_records_worker_user_id
        ON worker_termination_records(worker_user_id);

      CREATE INDEX IF NOT EXISTS idx_worker_termination_records_department_id
        ON worker_termination_records(department_id);

      CREATE INDEX IF NOT EXISTS idx_worker_termination_records_created_at
        ON worker_termination_records(created_at);
    `).catch((err) => {
      terminationTableReadyPromise = null;
      throw err;
    });
  }

  return terminationTableReadyPromise;
}

function buildTerminationLetter({
  workerName,
  departmentName,
  adminName,
  decisionStatement,
  terminationReason,
  finalCompensationDetails,
  propertyReturnChecklist,
  createdAt,
}) {
  const formattedDate = new Date(createdAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return [
    "FORMAL TERMINATION LETTER",
    "",
    `Date: ${formattedDate}`,
    `Department: ${departmentName}`,
    `Employee: ${workerName}`,
    "",
    `Dear ${workerName},`,
    "",
    decisionStatement,
    "",
    `Reason: ${terminationReason}`,
    "",
    `Final Compensation: ${finalCompensationDetails}`,
    "",
    `Property Return Checklist: ${propertyReturnChecklist}`,
    "",
    "Please complete all return obligations and coordinate with the department administration for final handover.",
    "",
    `Issued by: ${adminName}`,
  ].join("\n");
}

function mapWorkerWriteError(err) {
  if (err?.code === "23505") {
    if (err.constraint === "worker_profiles_nic_number_key") {
      return "This NIC number is already used by another worker record.";
    }

    if (err.constraint === "users_email_key") {
      return "This email address is already used by another user account.";
    }
  }

  return err.message;
}

exports.getWorkers = async (req, res) => {
  const isSystemAdmin = req.user.role === "SYSTEM_ADMIN";
  const departmentId = isSystemAdmin
    ? req.query.department_id || null
    : req.user.department_id;
  const includeInactive = req.query.include_inactive === "true";

  if (!isSystemAdmin && !departmentId) {
    return failure(res, "No department assigned to this user", 403);
  }

  try {
    const params = [];
    let whereClause = `WHERE u.role = 'WORKER'`;

    if (!includeInactive) {
      whereClause += ` AND u.is_active = TRUE`;
    }

    if (departmentId) {
      params.push(departmentId);
      whereClause += ` AND u.department_id = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT u.id,
              u.name,
              u.email,
              u.department_id,
              d.name AS department_name,
              wp.full_name,
              wp.name_initials,
              wp.nic_number,
              wp.designation,
              wp.employment_type,
              wp.salary,
              wp.date_of_appointment,
              wp.bank_name,
              wp.account_number,
              wp.iban,
              wp.employment_status,
              wp.profile_picture_url,
              wp.nic_copy_url
       FROM users u
       JOIN worker_profiles wp ON wp.user_id = u.id
       JOIN departments d ON d.id = u.department_id
       ${whereClause}
       ORDER BY wp.full_name`,
      params
    );

    return success(res, result.rows);
  } catch (err) {
    console.error("[getWorkers error]", err);
    return failure(res, err.message);
  }
};

exports.updateWorker = async (req, res) => {
  const { id } = req.params;
  const {
    full_name,
    name_initials,
    designation,
    employment_type,
    employment_status,
    address,
    salary,
    date_of_appointment,
    bank_name,
    account_number,
    iban,
  } = req.body;

  try {
    // Verify worker belongs to this admin's department
    const check = await pool.query(
      `SELECT u.id FROM users u
       WHERE u.id = $1 AND u.role = 'WORKER' AND u.department_id = $2`,
      [id, req.user.department_id]
    );

    if (check.rows.length === 0) {
      return failure(res, "Worker not found or access denied", 404);
    }

    // Keep users.name in sync with full_name
    if (full_name) {
      await pool.query(`UPDATE users SET name = $1 WHERE id = $2`, [full_name, id]);
    }

    const result = await pool.query(
      `UPDATE worker_profiles
       SET full_name          = $1,
           name_initials      = $2,
           designation        = $3,
           employment_type    = $4,
           employment_status  = $5,
           address            = $6,
           salary             = $7,
           date_of_appointment = $8,
           bank_name          = $9,
           account_number     = $10,
           iban               = $11
       WHERE user_id = $12
       RETURNING *`,
      [
        full_name || null,
        name_initials || null,
        designation || null,
        employment_type || null,
        employment_status || "ACTIVE",
        address || null,
        salary ? parseFloat(salary) : null,
        date_of_appointment || null,
        bank_name || null,
        account_number || null,
        iban || null,
        id,
      ]
    );

    return success(res, result.rows[0]);
  } catch (err) {
    return failure(res, mapWorkerWriteError(err));
  }
};

exports.removeWorker = async (req, res) => {
  const { id } = req.params;
  const {
    admin_password,
    decision_statement,
    termination_reason,
    final_compensation_details,
    property_return_checklist,
  } = req.body;

  if (
    !admin_password ||
    !decision_statement ||
    !termination_reason ||
    !final_compensation_details ||
    !property_return_checklist
  ) {
    return failure(
      res,
      "admin_password, decision_statement, termination_reason, final_compensation_details, and property_return_checklist are required",
      400
    );
  }

  try {
    await ensureWorkerTerminationTableExists();
  } catch (err) {
    return failure(res, err.message);
  }

  const client = await pool.connect();

  try {
    const adminResult = await client.query(
      `SELECT id, name, password_hash, department_id
       FROM users
       WHERE id = $1 AND role = 'DEPT_ADMIN' AND is_active = TRUE`,
      [req.user.id]
    );

    if (adminResult.rows.length === 0) {
      return failure(res, "Department admin not found", 403);
    }

    const admin = adminResult.rows[0];
    const passwordMatches = await bcrypt.compare(admin_password, admin.password_hash);

    if (!passwordMatches) {
      return failure(res, "Department admin password is incorrect", 401);
    }

    const workerResult = await client.query(
      `SELECT u.id,
              u.name,
              u.email,
              u.is_active,
              u.department_id,
              wp.full_name,
              wp.employment_status,
              d.name AS department_name
       FROM users u
       JOIN worker_profiles wp ON wp.user_id = u.id
       JOIN departments d ON d.id = u.department_id
       WHERE u.id = $1
         AND u.role = 'WORKER'
         AND u.department_id = $2`,
      [id, admin.department_id]
    );

    if (workerResult.rows.length === 0) {
      return failure(res, "Worker not found or access denied", 404);
    }

    const worker = workerResult.rows[0];

    if (!worker.is_active) {
      return failure(res, "Worker is already removed", 400);
    }

    const activeAssignmentsResult = await client.query(
      `SELECT COUNT(*)::int AS active_count
       FROM complaint_assignments
       WHERE worker_user_id = $1
         AND department_id = $2
         AND status IN ('ASSIGNED', 'IN_PROGRESS')`,
      [id, admin.department_id]
    );

    if (activeAssignmentsResult.rows[0].active_count > 0) {
      return failure(
        res,
        "Worker still has active assignments. Reassign or complete them before removal.",
        400
      );
    }

    const createdAt = new Date().toISOString();
    const letterBody = buildTerminationLetter({
      workerName: worker.full_name || worker.name,
      departmentName: worker.department_name,
      adminName: admin.name,
      decisionStatement: decision_statement.trim(),
      terminationReason: termination_reason.trim(),
      finalCompensationDetails: final_compensation_details.trim(),
      propertyReturnChecklist: property_return_checklist.trim(),
      createdAt,
    });

    await client.query("BEGIN");

    const terminationResult = await client.query(
      `INSERT INTO worker_termination_records (
         worker_user_id,
         department_id,
         terminated_by_user_id,
         worker_name_snapshot,
         worker_email_snapshot,
         admin_name_snapshot,
         decision_statement,
         termination_reason,
         final_compensation_details,
         property_return_checklist,
         letter_body
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, created_at`,
      [
        worker.id,
        admin.department_id,
        admin.id,
        worker.full_name || worker.name,
        worker.email,
        admin.name,
        decision_statement.trim(),
        termination_reason.trim(),
        final_compensation_details.trim(),
        property_return_checklist.trim(),
        letterBody,
      ]
    );

    await client.query(
      `UPDATE worker_profiles
       SET employment_status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [worker.id]
    );

    await client.query(
      `UPDATE users
       SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [worker.id]
    );

    await client.query("COMMIT");

    return success(
      res,
      {
        worker_id: worker.id,
        worker_name: worker.full_name || worker.name,
        termination_record_id: terminationResult.rows[0].id,
        terminated_at: terminationResult.rows[0].created_at,
        letter_body: letterBody,
      },
      200,
      "Worker removed successfully"
    );
  } catch (err) {
    await client.query("ROLLBACK");
    return failure(res, err.message);
  } finally {
    client.release();
  }
};

exports.createWorker = async (req, res) => {
  const admin = req.user;
  const client = await pool.connect();

  try {
    const {
      email,
      password,
      full_name,
      name_initials,
      nic_number,
      address,
      designation,
      employment_type,
      salary,
      date_of_appointment,
      previous_employer,
      bank_name,
      account_number,
      iban,
      employment_status,
    } = req.body;

    if (!email || !password || !full_name || !nic_number) {
      return failure(res, "email, password, full_name, and nic_number are required", 400);
    }

    const hash = await bcrypt.hash(password, 10);

    let profileUrl = null;
    let nicUrl = null;

    if (req.files?.profile_picture) {
      const file = req.files.profile_picture[0];
      const fileName = `profile-${Date.now()}-${file.originalname}`;
      await minioClient.putObject(BUCKET, fileName, file.buffer);
      profileUrl = `${MINIO_URL}/${BUCKET}/${fileName}`;
    }

    if (req.files?.nic_copy) {
      const file = req.files.nic_copy[0];
      const fileName = `nic-${Date.now()}-${file.originalname}`;
      await minioClient.putObject(BUCKET, fileName, file.buffer);
      nicUrl = `${MINIO_URL}/${BUCKET}/${fileName}`;
    }

    await client.query("BEGIN");

    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash, role, department_id)
       VALUES ($1, $2, $3, 'WORKER', $4)
       RETURNING id`,
      [full_name, email, hash, admin.department_id]
    );

    const userId = userResult.rows[0].id;

    const workerResult = await client.query(
      `INSERT INTO worker_profiles (
        user_id,
        department_id,
        full_name,
        name_initials,
        nic_number,
        address,
        designation,
        employment_type,
        salary,
        date_of_appointment,
        previous_employer,
        bank_name,
        account_number,
        iban,
        profile_picture_url,
        nic_copy_url,
        employment_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        userId,
        admin.department_id,
        full_name,
        name_initials || null,
        nic_number,
        address || null,
        designation || null,
        employment_type || null,
        salary || null,
        date_of_appointment || null,
        previous_employer || null,
        bank_name || null,
        account_number || null,
        iban || null,
        profileUrl,
        nicUrl,
        employment_status || "ACTIVE",
      ]
    );

    await client.query("COMMIT");

    return success(res, { user_id: userId, ...workerResult.rows[0] }, 201);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[createWorker error]", err);
    return failure(res, mapWorkerWriteError(err));
  } finally {
    client.release();
  }
};
