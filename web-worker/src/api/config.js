const normalizeUrl = (value) => value.replace(/\/+$/, "");

export const API_BASE_URL = normalizeUrl(
  import.meta.env.VITE_API_BASE_URL || "/api"
);

export const SOCKET_URL = normalizeUrl(
  import.meta.env.VITE_SOCKET_URL || window.location.origin
);
