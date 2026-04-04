import { GlobeIcon } from "../components/PublicIcons";
import LanguageSelector from "../components/LanguageSelector";
import { useCitizenI18n } from "../i18n";

export default function CitizenLanguageSetup({ language, onLanguageChange, onContinue, saving, error }) {
  const { t } = useCitizenI18n();

  return (
    <div className="auth-page">
      <div className="auth-card citizen-setup-card">
        <div className="auth-gov-header">
          <div className="auth-gov-title">{t("auth.govTitle")}</div>
        </div>

        <div className="citizen-settings-title-row">
          <span className="citizen-settings-icon">
            <GlobeIcon size={18} />
          </span>
          <div>
            <div className="auth-logo">{t("portal.brand")}</div>
            <div className="auth-subtitle">{t("portal.citizen")}</div>
          </div>
        </div>

        <h2 className="citizen-settings-heading">{t("setup.title")}</h2>
        <p className="citizen-settings-copy">{t("setup.subtitle")}</p>

        {error ? <div className="alert alert-error">{error}</div> : null}

        <LanguageSelector value={language} onChange={onLanguageChange} disabled={saving} />

        <button type="button" className="auth-btn" onClick={onContinue} disabled={saving}>
          {saving ? t("settings.saving") : t("setup.continue")}
        </button>
      </div>
    </div>
  );
}
