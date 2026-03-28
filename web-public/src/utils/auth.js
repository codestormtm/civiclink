// Centralized auth helpers for web-public.
// All reads/writes/clears of auth state go through here.

const KEYS = {
  TOKEN: "token",
  ROLE: "role",
  NAME: "name",
};

export function setAuth({ token, role, name }) {
  localStorage.setItem(KEYS.TOKEN, token);
  localStorage.setItem(KEYS.ROLE, role || "");
  localStorage.setItem(KEYS.NAME, name || "");
}

export function clearAuth() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}

export function getToken() {
  return localStorage.getItem(KEYS.TOKEN);
}

export function getRole() {
  return localStorage.getItem(KEYS.ROLE);
}

export function getName() {
  return localStorage.getItem(KEYS.NAME) || "Citizen";
}

// Decode JWT payload without verifying signature.
function decodeToken(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

// Returns true if a valid, non-expired CITIZEN token exists.
export function isCitizenAuthenticated() {
  const token = getToken();
  if (!token) return false;
  const payload = decodeToken(token);
  if (!payload) return false;
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    clearAuth();
    return false;
  }
  if (getRole() !== "CITIZEN") return false;
  return true;
}
