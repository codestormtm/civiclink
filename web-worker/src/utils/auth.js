const KEYS = {
  TOKEN: "token",
  ROLE: "role",
  NAME: "name",
  DEPARTMENT: "department",
  PREFERRED_LANGUAGE: "preferred_language",
};

export function setAuth({ token, role, name, department_name, preferred_language }) {
  localStorage.setItem(KEYS.TOKEN, token);
  localStorage.setItem(KEYS.ROLE, role || "");
  localStorage.setItem(KEYS.NAME, name || "");

  if (department_name) {
    localStorage.setItem(KEYS.DEPARTMENT, department_name);
  } else {
    localStorage.removeItem(KEYS.DEPARTMENT);
  }

  if (preferred_language) {
    localStorage.setItem(KEYS.PREFERRED_LANGUAGE, preferred_language);
  } else {
    localStorage.removeItem(KEYS.PREFERRED_LANGUAGE);
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

export function getPreferredLanguage() {
  return localStorage.getItem(KEYS.PREFERRED_LANGUAGE) || "";
}

export function setPreferredLanguage(preferredLanguage) {
  if (preferredLanguage) {
    localStorage.setItem(KEYS.PREFERRED_LANGUAGE, preferredLanguage);
    return;
  }

  localStorage.removeItem(KEYS.PREFERRED_LANGUAGE);
}
