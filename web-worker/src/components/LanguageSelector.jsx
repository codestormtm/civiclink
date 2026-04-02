import { WORKER_LANGUAGES } from "../utils/language";

export default function LanguageSelector({ value, onChange, disabled = false }) {
  return (
    <div
      className="worker-language-selector notranslate"
      role="tablist"
      aria-label="Select language"
      translate="no"
    >
      {WORKER_LANGUAGES.map((language) => (
        <button
          key={language.code}
          type="button"
          className={`worker-language-btn ${value === language.code ? "is-active" : ""}`}
          onClick={() => onChange(language.code)}
          disabled={disabled}
        >
          {language.label}
        </button>
      ))}
    </div>
  );
}
