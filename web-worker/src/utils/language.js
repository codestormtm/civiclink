import { WORKER_LANGUAGES } from "../i18n";

const LANGUAGE_STORAGE_KEY = "worker_language";
const DEFAULT_LANGUAGE = "en";

export function getStoredLanguage() {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return WORKER_LANGUAGES.some((language) => language.code === storedLanguage)
    ? storedLanguage
    : DEFAULT_LANGUAGE;
}

export function setStoredLanguage(language) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

export function applyLanguage(language) {
  if (typeof window === "undefined") {
    return;
  }

  const nextLanguage = WORKER_LANGUAGES.some((item) => item.code === language)
    ? language
    : DEFAULT_LANGUAGE;

  window.document.documentElement.lang = nextLanguage;
}
