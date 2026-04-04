import { Globe2 } from "lucide-react";
import { useState } from "react";
import LanguageSelector from "../components/LanguageSelector";
import { useWorkerI18n } from "../i18n";

export default function WorkerLanguageSetup({ language, onLanguageChange, onContinue }) {
  const { t } = useWorkerI18n();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = async () => {
    if (!language) {
      setError(t("onboarding.error"));
      return;
    }

    setError("");
    setSaving(true);

    try {
      await onContinue(language);
    } catch (err) {
      setError(err?.response?.data?.message || t("settings.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="worker-auth-shell">
      <div className="worker-auth-card worker-settings-card">
        <div className="worker-brand worker-brand-auth">
          <div className="worker-brand-icon">C</div>
          <div className="worker-brand-copy notranslate" translate="no">
            <div className="worker-brand-name">{t("portal.brand")}</div>
            <div className="worker-brand-sub">{t("portal.worker")}</div>
          </div>
        </div>

        <div className="worker-settings-heading">
          <span className="worker-settings-icon">
            <Globe2 size={18} aria-hidden="true" />
          </span>
          <div className="worker-auth-kicker">{t("settings.languageTitle")}</div>
        </div>

        <h1>{t("onboarding.title")}</h1>
        <p className="worker-auth-copy">{t("onboarding.subtitle")}</p>

        {error ? <div className="worker-alert worker-alert-error">{error}</div> : null}

        <LanguageSelector value={language} onChange={onLanguageChange} disabled={saving} />

        <button
          type="button"
          className="worker-primary-btn worker-btn-with-icon"
          onClick={handleContinue}
          disabled={saving}
        >
          <span>{saving ? t("settings.saving") : t("onboarding.continue")}</span>
        </button>
      </div>
    </div>
  );
}
