import { WORKER_LANGUAGES, useWorkerI18n } from "../i18n";

export default function LanguageSelector({ value, onChange, disabled = false }) {
  const { t } = useWorkerI18n();

  const labels = {
    en: t("language.english"),
    si: t("language.sinhala"),
    ta: t("language.tamil"),
  };

  return (
    <div
      className="worker-language-selector notranslate"
      role="tablist"
      aria-label={t("settings.languageTitle")}
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
          {labels[language.code] || language.label}
        </button>
      ))}
    </div>
  );
}
