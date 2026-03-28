const FALLBACK_PROTOCOL = typeof window !== "undefined" ? window.location.protocol : "http:";
const FALLBACK_HOSTNAME = typeof window !== "undefined" ? window.location.hostname : "localhost";
const DEFAULT_BACKEND_ORIGIN = `${FALLBACK_PROTOCOL}//${FALLBACK_HOSTNAME}:5002`;

const normalizeUrl = (value) => value.replace(/\/+$/, "");

export const API_BASE_URL = normalizeUrl(
  import.meta.env.VITE_API_BASE_URL || `${DEFAULT_BACKEND_ORIGIN}/api`
);

export const SOCKET_URL = normalizeUrl(
  import.meta.env.VITE_SOCKET_URL || DEFAULT_BACKEND_ORIGIN
);
