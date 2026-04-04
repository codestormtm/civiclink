// Centralized auth helpers for web-public.
// All reads/writes/clears of auth state go through here.

import { signOut } from "firebase/auth";
import { auth, isFirebaseConfigured } from "../firebase/client";
import { clearCitizenPortalState } from "./portalState";

const KEYS = {
  TOKEN: "token",
  ROLE: "role",
  NAME: "name",
  PREFERRED_LANGUAGE: "preferred_language",
};

export function setAuth({ token, role, name, preferred_language }) {
  localStorage.setItem(KEYS.TOKEN, token);
  localStorage.setItem(KEYS.ROLE, role || "");
  localStorage.setItem(KEYS.NAME, name || "");

  if (preferred_language) {
    localStorage.setItem(KEYS.PREFERRED_LANGUAGE, preferred_language);
  } else {
    localStorage.removeItem(KEYS.PREFERRED_LANGUAGE);
  }
}

export function clearAuth() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  clearCitizenPortalState();
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
