const KEYS = {
  TOKEN: "token",
  ROLE: "role",
  NAME: "name",
  DEPARTMENT: "department",
};

export function setAuth({ token, role, name, department_name }) {
  localStorage.setItem(KEYS.TOKEN, token);
  localStorage.setItem(KEYS.ROLE, role || "");
  localStorage.setItem(KEYS.NAME, name || "");

  if (department_name) {
    localStorage.setItem(KEYS.DEPARTMENT, department_name);
  } else {
    localStorage.removeItem(KEYS.DEPARTMENT);
  }
}

export function clearAuth() {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}

export function getToken() {
  return localStorage.getItem(KEYS.TOKEN);
}

export function getRole() {
  return localStorage.getItem(KEYS.ROLE) || "";
}

export function getName() {
  return localStorage.getItem(KEYS.NAME) || "";
}

export function getDepartment() {
  return localStorage.getItem(KEYS.DEPARTMENT) || "";
}
