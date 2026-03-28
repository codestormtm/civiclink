const { pool } = require("../config/db");
const bcrypt = require("bcrypt");
const { success, failure } = require("../utils/response");

exports.createDeptAdmin = async (req, res) => {
  const { name, email, password, department_id } = req.body;

  if (!name || !email || !password || !department_id) {
    return failure(res, "name, email, password, and department_id are required", 400);
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name,email,password_hash,role,department_id)
       VALUES ($1,$2,$3,'DEPT_ADMIN',$4)
       RETURNING id,name,email,department_id`,
      [name, email, hash, department_id]
    );

    return success(res, result.rows[0], 201);
  } catch (err) {
    console.error("[createDeptAdmin error]", err.message, err.detail || "");
    return failure(res, err.message);
  }
};
