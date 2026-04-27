import { io } from "socket.io-client";
import { SOCKET_URL } from "./config";
import { getToken } from "../utils/auth";

const socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: { token: getToken() },
  transports: ["websocket", "polling"],
});

export function syncSocketAuth() {
  socket.auth = { token: getToken() };
}

export function connectAdminSocket() {
  syncSocketAuth();

  if (!socket.connected) {
    socket.connect();
  }
}

export function disconnectAdminSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}

export default socket;
