const LANGUAGE_STORAGE_KEY = "worker_language";
const DEFAULT_LANGUAGE = "en";

export const WORKER_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "si", label: "සිංහල" },
  { code: "ta", label: "தமிழ்" },
];

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

export function applyLanguage(language, attempt = 0) {
  if (typeof window === "undefined") {
    return;
  }

  const nextLanguage = WORKER_LANGUAGES.some((item) => item.code === language)
    ? language
    : DEFAULT_LANGUAGE;

  window.document.documentElement.lang = nextLanguage;

  if (typeof window.changeLanguage === "function") {
    window.changeLanguage(nextLanguage);
    return;
  }

  if (attempt < 10) {
    window.setTimeout(() => applyLanguage(nextLanguage, attempt + 1), 500);
  }
}
