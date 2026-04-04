import { GlobeIcon } from "../components/PublicIcons";
import LanguageSelector from "../components/LanguageSelector";
import { useCitizenI18n } from "../i18n";

export default function CitizenSettings({
  language,
  onLanguageChange,
  onSave,
  saving,
  error,
  success,
}) {
  const { t } = useCitizenI18n();
  const selectedLanguageLabelByCode = {
    en: t("language.english"),
    si: t("language.sinhala"),
    ta: t("language.tamil"),
  };

  return (
    <div className="container citizen-settings-page">
      <div className="page-heading">
        <h2>{t("settings.title")}</h2>
        <p>{t("settings.subtitle")}</p>
      </div>

      <div className="card citizen-settings-panel">
        {error ? <div className="alert alert-error">{error}</div> : null}
        {success ? <div className="alert alert-success">{success}</div> : null}

        <div className="citizen-settings-title-row">
          <span className="citizen-settings-icon">
            <GlobeIcon size={18} />
          </span>
          <div className="citizen-settings-title-copy">
            <div className="section-label">{t("auth.preferredLanguage")}</div>
            <p className="citizen-settings-inline-copy">{t("setup.subtitle")}</p>
          </div>
        </div>

        <div className="citizen-settings-current">
          <span className="citizen-settings-current-label">{t("auth.preferredLanguage")}</span>
          <strong>{selectedLanguageLabelByCode[language] || t("language.english")}</strong>
        </div>

        <LanguageSelector value={language} onChange={onLanguageChange} disabled={saving} />

        <button
          type="button"
          className="citizen-action-btn is-maroon citizen-action-btn-full citizen-settings-save-btn"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? t("settings.saving") : t("settings.save")}
        </button>
      </div>
    </div>
  );
}
