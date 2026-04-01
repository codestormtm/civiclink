// Centralized auth helpers for web-public.
// All reads/writes/clears of auth state go through here.

import { signOut } from "firebase/auth";
import { auth, isFirebaseConfigured } from "../firebase/client";

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

export async function clearCitizenSession() {
  clearAuth();

  if (!isFirebaseConfigured() || !auth) {
    return;
  }

  try {
    await signOut(auth);
  } catch {
    // Local CivicLink session is already cleared. Ignore Firebase sign-out errors
    // so logout still completes and the app returns to the login screen.
  }
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
