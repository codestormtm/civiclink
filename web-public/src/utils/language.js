import { CITIZEN_LANGUAGES } from "../i18n";

const LANGUAGE_STORAGE_KEY = "citizen_language";
const PENDING_SIGNUP_LANGUAGE_KEY = "citizen_pending_signup_language";
const DEFAULT_LANGUAGE = "en";

function isSupportedLanguage(language) {
  return CITIZEN_LANGUAGES.some((item) => item.code === language);
}

export function getStoredLanguage() {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isSupportedLanguage(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE;
}

export function setStoredLanguage(language) {
  if (typeof window === "undefined" || !isSupportedLanguage(language)) {
    return;
  }

  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

export function clearStoredLanguage() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LANGUAGE_STORAGE_KEY);
}

export function getPendingSignupLanguage() {
  if (typeof window === "undefined") {
    return "";
  }

  const storedLanguage = window.localStorage.getItem(PENDING_SIGNUP_LANGUAGE_KEY);
  return isSupportedLanguage(storedLanguage) ? storedLanguage : "";
}

export function setPendingSignupLanguage(language) {
  if (typeof window === "undefined" || !isSupportedLanguage(language)) {
    return;
  }

  window.localStorage.setItem(PENDING_SIGNUP_LANGUAGE_KEY, language);
}

export function clearPendingSignupLanguage() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PENDING_SIGNUP_LANGUAGE_KEY);
}

export function applyLanguage(language) {
  if (typeof window === "undefined") {
    return;
  }

  const nextLanguage = isSupportedLanguage(language) ? language : DEFAULT_LANGUAGE;
  window.document.documentElement.lang = nextLanguage;
}
