import { io } from "socket.io-client";
import { SOCKET_URL } from "./config";
import { getToken } from "../utils/auth";

const socket = io(SOCKET_URL, {
  autoConnect: Boolean(getToken()),
  auth: {
    token: getToken(),
  },
  transports: ["websocket", "polling"],
});

export default socket;
