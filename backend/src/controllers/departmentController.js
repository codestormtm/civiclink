const { pool } = require("../config/db");
const bcrypt = require("bcrypt");
const { success, failure } = require("../utils/response");

let departmentChangeLogReadyPromise = null;
const DEFAULT_ISSUE_TYPE_NAME = "General Complaint";
const DEFAULT_ISSUE_TYPE_DESCRIPTION =
  "Fallback complaint type created automatically so new departments are available in citizen intake immediately.";

function ensureDepartmentChangeLogTableExists() {
  if (!departmentChangeLogReadyPromise) {
    departmentChangeLogReadyPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS department_change_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        changed_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        old_values JSONB NOT NULL,
        new_values JSONB NOT NULL,
        changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_department_change_logs_department_changed_at
        ON department_change_logs(department_id, changed_at DESC);
    `).catch((err) => {
      departmentChangeLogReadyPromise = null;
      throw err;
    });
  }

  return departmentChangeLogReadyPromise;
}

function mapDepartmentWriteError(err) {
  if (err?.code === "23505") {
    if (err.constraint === "departments_code_key") {
      return "This department code is already in use.";
    }
  }

  return err.message;
}

async function ensureDefaultIssueType(client, departmentId) {
  await client.query(
    `INSERT INTO department_issue_types (department_id, name, description)
     SELECT $1, $2, $3
     WHERE NOT EXISTS (
       SELECT 1
       FROM department_issue_types
       WHERE department_id = $1
         AND is_active = TRUE
     )`,
    [departmentId, DEFAULT_ISSUE_TYPE_NAME, DEFAULT_ISSUE_TYPE_DESCRIPTION]
  );
}

exports.createDepartment = async (req, res) => {
  const { name, code, contact_email } = req.body;

  if (!name || !code) {
    return failure(res, "name and code are required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO departments (name, code, contact_email)
       VALUES ($1, UPPER($2), $3)
       RETURNING *`,
      [name.trim(), code.trim(), contact_email || null]
    );

    await ensureDefaultIssueType(client, result.rows[0].id);
    await client.query("COMMIT");

    return success(res, result.rows[0], 201);
  } catch (err) {
    await client.query("ROLLBACK");
    return failure(res, mapDepartmentWriteError(err));
  } finally {
    client.release();
  }
};

exports.getDepartments = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*,
              COUNT(DISTINCT dit.id) AS issue_type_count,
              COUNT(DISTINCT CASE WHEN u.role = 'WORKER' THEN u.id END) AS worker_count,
              COUNT(DISTINCT c.id) AS complaint_count
       FROM departments d
       LEFT JOIN department_issue_types dit ON dit.department_id = d.id
       LEFT JOIN users u ON u.department_id = d.id
       LEFT JOIN complaints c ON c.department_id = d.id
       GROUP BY d.id
       ORDER BY d.name`
    );
    return success(res, result.rows);
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.createDepartmentIssueType = async (req, res) => {
  const { departmentId } = req.params;
  const { name, description } = req.body;

  if (!name) {
    return failure(res, "name is required", 400);
  }

  try {
    const result = await pool.query(
      `INSERT INTO department_issue_types (department_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [departmentId, name, description || null]
    );

    return success(res, result.rows[0], 201);
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.getDepartmentIssueTypes = async (req, res) => {
  const { departmentId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, department_id, name, description, is_active, created_at, updated_at
       FROM department_issue_types
       WHERE department_id = $1
       ORDER BY name`,
      [departmentId]
    );

    return success(res, result.rows);
  } catch (err) {
    return failure(res, err.message);
  }
};

exports.updateDepartment = async (req, res) => {
  const { departmentId } = req.params;
  const { name, code, contact_email, admin_password } = req.body;

  if (!name || !code || !admin_password) {
    return failure(res, "name, code, and admin_password are required", 400);
  }

  try {
    await ensureDepartmentChangeLogTableExists();
  } catch (err) {
    return failure(res, err.message);
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const adminResult = await client.query(
      `SELECT id, password_hash
       FROM users
       WHERE id = $1 AND role = 'SYSTEM_ADMIN' AND is_active = TRUE`,
      [req.user.id]
    );

    if (adminResult.rows.length === 0) {
      return failure(res, "System admin not found", 403);
    }

    const passwordMatches = await bcrypt.compare(admin_password, adminResult.rows[0].password_hash);

    if (!passwordMatches) {
      return failure(res, "System admin password is incorrect", 401);
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const currentDepartmentResult = await client.query(
      `SELECT id, name, code, contact_email
       FROM departments
       WHERE id = $1
       FOR UPDATE`,
      [departmentId]
    );

    if (currentDepartmentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return failure(res, "Department not found", 404);
    }

    const previousValues = currentDepartmentResult.rows[0];

    const updateResult = await client.query(
      `UPDATE departments
       SET name = $1,
           code = UPPER($2),
           contact_email = $3
       WHERE id = $4
       RETURNING *`,
      [name.trim(), code.trim(), contact_email || null, departmentId]
    );

    const updatedDepartment = updateResult.rows[0];

    await client.query(
      `INSERT INTO department_change_logs (
         department_id, changed_by_user_id, old_values, new_values
       )
       VALUES ($1, $2, $3::jsonb, $4::jsonb)`,
      [
        departmentId,
        req.user.id,
        JSON.stringify(previousValues),
        JSON.stringify({
          name: updatedDepartment.name,
          code: updatedDepartment.code,
          contact_email: updatedDepartment.contact_email,
        }),
      ]
    );

    await client.query("COMMIT");
    transactionStarted = false;
    return success(res, updatedDepartment);
  } catch (err) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }
    return failure(res, mapDepartmentWriteError(err));
  } finally {
    client.release();
  }
};
