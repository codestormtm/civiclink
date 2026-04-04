import { CITIZEN_LANGUAGES, useCitizenI18n } from "../i18n";

export default function LanguageSelector({ value, onChange, disabled }) {
  const { t } = useCitizenI18n();

  const labels = {
    en: t("language.english"),
    si: t("language.sinhala"),
    ta: t("language.tamil"),
  };

  return (
    <div className="citizen-language-selector">
      {CITIZEN_LANGUAGES.map((language) => (
        <button
          key={language.code}
          type="button"
          onClick={() => onChange(language.code)}
          disabled={disabled}
          className={`citizen-language-btn ${value === language.code ? "is-active" : ""}`}
          aria-pressed={value === language.code}
        >
          {labels[language.code] || language.label}
        </button>
      ))}
    </div>
  );
}
