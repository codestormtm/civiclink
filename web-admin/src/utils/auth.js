// Centralized auth helpers for web-admin.
// All reads/writes/clears of auth state go through here.

const KEYS = {
  TOKEN: "token",
  ROLE: "role",
  NAME: "name",
  DEPARTMENT: "department",
};

export function setAuth({ token, role, name, department_name }) {
  localStorage.setItem(KEYS.TOKEN, token);
  localStorage.setItem(KEYS.ROLE, role);
  localStorage.setItem(KEYS.NAME, name || "");
  if (department_name) localStorage.setItem(KEYS.DEPARTMENT, department_name);
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
  return localStorage.getItem(KEYS.NAME) || "";
}

export function getDepartment() {
  return localStorage.getItem(KEYS.DEPARTMENT) || "";
}

// Decode JWT payload without verifying signature.
// Used only to check expiry on the client side.
function decodeToken(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

// Returns true if a valid, non-expired token exists.
export function isAuthenticated() {
  const token = getToken();
  if (!token) return false;
  const payload = decodeToken(token);
  if (!payload) return false;
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    clearAuth(); // proactively clear expired session
    return false;
  }
  return true;
}
