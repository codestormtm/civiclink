const ROLES = require("../constants/roles");
const { pool } = require("../config/db");

function normalizeUser(user) {
  return {
    id: user?.id || null,
    role: user?.role || "",
    department_id: user?.department_id || null,
  };
}

function canAccessConversation(user, conversation) {
  const currentUser = normalizeUser(user);

  if (!currentUser.id || !conversation) {
    return false;
  }

  if (currentUser.role === ROLES.SYSTEM_ADMIN) {
    return true;
  }

  if (currentUser.role === ROLES.DEPT_ADMIN) {
    return conversation.department_id === currentUser.department_id;
  }

  if (currentUser.role === ROLES.WORKER) {
    return conversation.worker_user_id === currentUser.id;
  }

  return false;
}

async function getConversationForUser(conversationId, user) {
  const result = await pool.query(
    `SELECT cc.*,
            c.title AS complaint_title,
            admin_user.name AS admin_name,
            worker_user.name AS worker_name,
            wp.local_call_number
     FROM communication_conversations cc
     LEFT JOIN complaints c ON c.id = cc.complaint_id
     JOIN users admin_user ON admin_user.id = cc.admin_user_id
     JOIN users worker_user ON worker_user.id = cc.worker_user_id
     JOIN worker_profiles wp ON wp.user_id = cc.worker_user_id
     WHERE cc.id = $1`,
    [conversationId]
  );

  const conversation = result.rows[0] || null;

  if (!canAccessConversation(user, conversation)) {
    return null;
  }

  return conversation;
}

module.exports = {
  canAccessConversation,
  getConversationForUser,
};
