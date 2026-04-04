import { Globe2 } from "lucide-react";
import { useEffect, useState } from "react";
import LanguageSelector from "../components/LanguageSelector";
import WorkerHeader from "../components/WorkerHeader";
import { useWorkerI18n } from "../i18n";

export default function WorkerSettings({
  user,
  language,
  onLanguageChange,
  onSave,
  onBack,
  onLogout,
  notificationPermission,
  onEnableNotifications,
}) {
  const { t } = useWorkerI18n();
  const [pendingLanguage, setPendingLanguage] = useState(language);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setPendingLanguage(language);
  }, [language]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await onSave(pendingLanguage);
      setSuccess(t("settings.saved"));
    } catch (err) {
      setError(err?.response?.data?.message || t("settings.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="worker-shell">
      <WorkerHeader
        user={user}
        notificationPermission={notificationPermission}
        onEnableNotifications={onEnableNotifications}
        onBack={onBack}
        onLogout={onLogout}
      />

      <main className="worker-wrap">
        <section className="worker-card worker-stack-lg worker-settings-panel">
          <div className="worker-section-title">
            <Globe2 size={18} aria-hidden="true" />
            <span>{t("settings.title")}</span>
          </div>

          <p className="worker-section-copy">{t("settings.subtitle")}</p>

          {error ? <div className="worker-alert worker-alert-error">{error}</div> : null}
          {success ? <div className="worker-alert worker-alert-success">{success}</div> : null}

          <div className="worker-settings-block">
            <div className="worker-meta-label">{t("settings.languageTitle")}</div>
            <p className="worker-section-copy">{t("settings.languageCopy")}</p>
            <LanguageSelector
              value={pendingLanguage}
              onChange={(nextLanguage) => {
                setPendingLanguage(nextLanguage);
                onLanguageChange(nextLanguage);
              }}
              disabled={saving}
            />
          </div>

          <div className="worker-settings-actions">
            <button
              type="button"
              className="worker-primary-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t("settings.saving") : t("settings.save")}
            </button>
            <button
              type="button"
              className="worker-secondary-btn"
              onClick={onBack}
              disabled={saving}
            >
              {t("settings.back")}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
