const { pool } = require("../config/db");
const {
  getGreeting,
  processMessage,
  getAvailableDepartmentsAndTypes,
  isAiConfigured,
} = require("../services/ai/intakeService");
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
       RETURNING id, title, status, submitted_at`,
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

    await pool.query(
      `UPDATE complaint_intake_sessions SET status = 'SUBMITTED', updated_at = NOW()
       WHERE session_token = $1`,
      [sessionToken]
    );

    res.json({ success: true, data: complaint.rows[0] });
  } catch (err) {
    logger.error("Failed to submit intake session", err);
    return failure(res, err.message || "Failed to submit intake session", err.statusCode || 500);
  }
};
