import { io } from "socket.io-client";
import { SOCKET_URL } from "./config";
import { getToken } from "../utils/auth";

const socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: { token: getToken() },
  transports: ["websocket", "polling"],
});

export function syncCitizenSocketAuth() {
  socket.auth = { token: getToken() };
}

export function connectCitizenSocket() {
  syncCitizenSocketAuth();

  if (!socket.connected) {
    socket.connect();
  }
}

export function connectPublicSocket() {
  socket.auth = {};

  if (!socket.connected) {
    socket.connect();
  }
}

export function disconnectCitizenSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}

export default socket;
