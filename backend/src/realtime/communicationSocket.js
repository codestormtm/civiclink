const { pool } = require("../config/db");
const { connectRedis } = require("../config/redis");
const { getConversationForUser } = require("../utils/communicationAccess");
const { userRoom } = require("../utils/socketRooms");
const logger = require("../utils/logger");

const EVENT_NAMES = [
  "conversation:message",
  "conversation:delivered",
  "conversation:typing",
  "conversation:presence",
  "conversation:seen",
  "conversation:key_public",
  "call:request",
  "call:accept",
  "call:reject",
  "call:offer",
  "call:answer",
  "call:ice_candidate",
  "call:end",
];

function conversationRoom(conversationId) {
  return `conversation:${conversationId}`;
}

function userSocketSet(userId) {
  return `communication:user:${userId}:sockets`;
}

function activeCallKey(callId) {
  return `communication:call:${callId}`;
}

async function withRedis(operation) {
  try {
    const redis = await connectRedis();
    return await operation(redis);
  } catch (err) {
    logger.error("Redis communication operation failed", err);
    return null;
  }
}

function sanitizeRelayPayload(payload, conversationId, socket) {
  return {
    ...payload,
    conversation_id: conversationId,
    conversation: payload?.conversation || null,
    sender_id: socket.data.user.id,
    sent_at: payload?.sent_at || new Date().toISOString(),
  };
}

async function authorizeConversation(socket, conversationId) {
  if (!socket.data.user?.id) {
    return null;
  }

  return getConversationForUser(conversationId, socket.data.user);
}

async function relayConversationEvent(io, socket, eventName, payload = {}) {
  const conversationId = String(payload.conversation_id || "").trim();
  if (!conversationId) {
    socket.emit("conversation:error", { event: eventName, error: "conversation_id is required" });
    return;
  }

  const conversation = await authorizeConversation(socket, conversationId);
  if (!conversation) {
    socket.emit("conversation:error", { event: eventName, error: "Access denied" });
    return;
  }

  const relayPayload = sanitizeRelayPayload(payload, conversationId, socket);
  relayPayload.conversation = relayPayload.conversation || {
    id: conversation.id,
    department_id: conversation.department_id,
    complaint_id: conversation.complaint_id,
    assignment_id: conversation.assignment_id,
    admin_user_id: conversation.admin_user_id,
    worker_user_id: conversation.worker_user_id,
    conversation_type: conversation.conversation_type,
    local_call_number: conversation.local_call_number,
    complaint_title: conversation.complaint_title,
    admin_name: conversation.admin_name,
    worker_name: conversation.worker_name,
  };

  if (eventName === "conversation:message") {
    await pool.query(
      `UPDATE communication_conversations
       SET last_message_time = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [conversationId]
    );
  }

  if (eventName === "conversation:typing") {
    await withRedis((redis) => redis.setEx(
      `communication:typing:${conversationId}:${socket.data.user.id}`,
      8,
      JSON.stringify({ typing: Boolean(payload.typing), updated_at: new Date().toISOString() })
    ));
  }

  if (eventName.startsWith("call:")) {
    const callId = String(payload.call_id || "").trim();
    if (callId) {
      if (eventName === "call:end" || eventName === "call:reject") {
        await withRedis((redis) => redis.del(activeCallKey(callId)));
      } else {
        await withRedis((redis) => redis.setEx(
          activeCallKey(callId),
          60 * 30,
          JSON.stringify({
            call_id: callId,
            conversation_id: conversationId,
            updated_at: new Date().toISOString(),
            event: eventName,
          })
        ));
      }
    }
  }

  const recipientIds = [
    conversation.admin_user_id,
    conversation.worker_user_id,
  ].filter((recipientId) => recipientId && recipientId !== socket.data.user.id);

  recipientIds.forEach((recipientId) => {
    io.to(userRoom(recipientId)).emit(eventName, relayPayload);
  });
}

function attachCommunicationSocket(io) {
  io.on("connection", async (socket) => {
    const userId = socket.data.user?.id;

    if (userId) {
      await withRedis(async (redis) => {
        await redis.sAdd(userSocketSet(userId), socket.id);
        await redis.expire(userSocketSet(userId), 60 * 60);
      });
    }

    socket.on("conversation:join", async (payload = {}) => {
      const conversationId = String(payload.conversation_id || "").trim();
      const conversation = await authorizeConversation(socket, conversationId);

      if (!conversation) {
        socket.emit("conversation:error", { event: "conversation:join", error: "Access denied" });
        return;
      }

      socket.join(conversationRoom(conversationId));
      socket.emit("conversation:joined", {
        conversation_id: conversationId,
        user_id: socket.data.user.id,
      });
      socket.to(conversationRoom(conversationId)).emit("conversation:presence", {
        conversation_id: conversationId,
        user_id: socket.data.user.id,
        state: "online",
        sent_at: new Date().toISOString(),
      });
    });

    EVENT_NAMES.forEach((eventName) => {
      socket.on(eventName, (payload = {}) => {
        void relayConversationEvent(io, socket, eventName, payload);
      });
    });

    socket.on("disconnect", async () => {
      if (!userId) {
        return;
      }

      await withRedis((redis) => redis.sRem(userSocketSet(userId), socket.id));
    });
  });
}

module.exports = {
  attachCommunicationSocket,
  conversationRoom,
};
