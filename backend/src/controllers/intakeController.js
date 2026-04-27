const { pool } = require("../config/db");
const {
  getGreeting,
  processMessage,
  getAvailableDepartmentsAndTypes,
  isAiConfigured,
} = require("../services/ai/intakeService");
const { logComplaintStatusChange } = require("../utils/complaintHistory");
const { ROOM_ADMINS } = require("../utils/socketRooms");
const logger = require("../utils/logger");
const { failure } = require("../utils/response");

// POST /api/intake/start
exports.startSession = async (req, res) => {
  try {
    const { language = "en" } = req.body;
    const citizenUserId = req.user.id;

    const greeting = getGreeting(language);
    const initialHistory = [{ role: "assistant", content: greeting }];

    const result = await pool.query(
      `INSERT INTO complaint_intake_sessions
         (citizen_user_id, current_language, chat_history, structured_draft)
       VALUES ($1, $2, $3, $4)
       RETURNING session_token`,
      [citizenUserId, language, JSON.stringify(initialHistory), JSON.stringify({})]
    );

    res.json({
      success: true,
      data: {
        session_token: result.rows[0].session_token,
        greeting,
        language,
        ai_available: isAiConfigured(),
      },
    });
  } catch (err) {
    logger.error("Failed to start intake session", err);
    return failure(res, err.message || "Failed to start intake session", err.statusCode || 500);
  }
};

// POST /api/intake/:sessionToken/message
exports.sendMessage = async (req, res) => {
  try {
    const { sessionToken } = req.params;
    const { message, latitude, longitude, address_text } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    const sessionResult = await pool.query(
      `SELECT * FROM complaint_intake_sessions WHERE session_token = $1`,
      [sessionToken]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    const session = sessionResult.rows[0];

    if (session.status !== "ACTIVE") {
      return res.status(400).json({ error: "Session is no longer active" });
    }

    if (session.citizen_user_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const departments = await getAvailableDepartmentsAndTypes();

    // If location coords were sent from the map picker, inject into draft before AI call
    const draftWithLocation = { ...session.structured_draft };
    if (latitude != null && longitude != null) {
      draftWithLocation.latitude = parseFloat(latitude);
      draftWithLocation.longitude = parseFloat(longitude);
      draftWithLocation.address_text = address_text || `${parseFloat(latitude).toFixed(5)}, ${parseFloat(longitude).toFixed(5)}`;
    }

    const aiResult = await processMessage({
      language: session.current_language,
      chatHistory: session.chat_history,
      structuredDraft: draftWithLocation,
      userMessage: message.trim(),
      departments,
    });

    const newHistory = [
      ...session.chat_history,
      { role: "user", content: message.trim() },
      { role: "assistant", content: aiResult.reply },
    ];

    await pool.query(
      `UPDATE complaint_intake_sessions
       SET chat_history = $1, structured_draft = $2, updated_at = NOW()
       WHERE session_token = $3`,
      [JSON.stringify(newHistory), JSON.stringify(aiResult.draft), sessionToken]
    );

    res.json({
      success: true,
      data: {
        reply: aiResult.reply,
        draft: aiResult.draft,
        is_complete: aiResult.is_complete,
        needs_location: aiResult.needs_location || false,
      },
    });
  } catch (err) {
    logger.error("Failed to process intake message", err);
    return failure(res, err.message || "Failed to process intake message", err.statusCode || 500);
  }
};

// GET /api/intake/:sessionToken
exports.getSession = async (req, res) => {
  try {
    const { sessionToken } = req.params;

    const result = await pool.query(
      `SELECT * FROM complaint_intake_sessions WHERE session_token = $1`,
      [sessionToken]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    const session = result.rows[0];
    if (session.citizen_user_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ success: true, data: session });
  } catch (err) {
    logger.error("Failed to fetch intake session", err);
    return failure(res, err.message || "Failed to fetch intake session", err.statusCode || 500);
  }
};

// POST /api/intake/:sessionToken/submit
exports.submitSession = async (req, res) => {
  try {
    const { sessionToken } = req.params;
    const citizenUserId = req.user.id;

    const sessionResult = await pool.query(
      `SELECT * FROM complaint_intake_sessions WHERE session_token = $1`,
      [sessionToken]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    const session = sessionResult.rows[0];

    if (session.citizen_user_id !== citizenUserId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (session.status === "SUBMITTED") {
      return res.status(400).json({ error: "Already submitted" });
    }

    const draft = session.structured_draft;

    // Allow override from request body (for "edit before submit" flow)
    const finalDraft = { ...draft, ...req.body };

    if (!finalDraft.department_id || !finalDraft.issue_type_id || !finalDraft.title || !finalDraft.description) {
      return res.status(400).json({
        error: "Incomplete complaint. Required: department_id, issue_type_id, title, description",
      });
    }

    const complaint = await pool.query(
      `INSERT INTO complaints
         (department_id, issue_type_id, reporter_user_id, title, description,
          address_text, latitude, longitude, location_source, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'SUBMITTED')
       RETURNING *`,
      [
        finalDraft.department_id,
        finalDraft.issue_type_id,
        citizenUserId,
        finalDraft.title,
        finalDraft.description,
        finalDraft.address_text || null,
        finalDraft.latitude ?? null,
        finalDraft.longitude ?? null,
        finalDraft.latitude != null && finalDraft.longitude != null ? "map" : null,
      ]
    );

    await logComplaintStatusChange({
      complaintId: complaint.rows[0].id,
      oldStatus: null,
      newStatus: "SUBMITTED",
      changedBy: citizenUserId,
      note: "Complaint submitted by citizen through AI intake",
    });

    const enrichedComplaint = await pool.query(
      `SELECT c.id,
              c.department_id,
              c.issue_type_id,
              c.reporter_user_id,
              c.title,
              c.description,
              c.latitude,
              c.longitude,
              c.address_text,
              c.location_source,
              c.status,
              c.priority_level,
              c.sla_due_at,
              CASE
                WHEN c.sla_due_at < NOW()
                  AND c.status NOT IN ('RESOLVED','CLOSED','REJECTED_WRONG_DEPARTMENT')
                THEN true ELSE false
              END AS sla_breached,
              c.rejection_reason,
              c.submitted_at,
              c.resolved_at,
              c.created_at,
              c.updated_at,
              d.name AS department_name,
              d.code AS department_code,
              dit.name AS issue_type_name,
              reporter.name AS reporter_name,
              latest_assignment.worker_user_id AS assigned_worker_id,
              assignee.name AS assigned_worker_name,
              latest_assignment.status AS assignment_status
       FROM complaints c
       JOIN departments d ON d.id = c.department_id
       JOIN department_issue_types dit ON dit.id = c.issue_type_id
       JOIN users reporter ON reporter.id = c.reporter_user_id
       LEFT JOIN LATERAL (
         SELECT ca.worker_user_id, ca.status, ca.assigned_at
         FROM complaint_assignments ca
         WHERE ca.complaint_id = c.id
         ORDER BY ca.assigned_at DESC
         LIMIT 1
       ) latest_assignment ON TRUE
       LEFT JOIN users assignee ON assignee.id = latest_assignment.worker_user_id
       WHERE c.id = $1`,
      [complaint.rows[0].id]
    );

    await pool.query(
      `UPDATE complaint_intake_sessions SET status = 'SUBMITTED', updated_at = NOW()
       WHERE session_token = $1`,
      [sessionToken]
    );

    const io = req.app.get("io");
    if (io && enrichedComplaint.rows[0]) {
      io.to(ROOM_ADMINS).emit("new_issue", enrichedComplaint.rows[0]);
    }

    res.json({ success: true, data: complaint.rows[0] });
  } catch (err) {
    logger.error("Failed to submit intake session", err);
    return failure(res, err.message || "Failed to submit intake session", err.statusCode || 500);
  }
};
