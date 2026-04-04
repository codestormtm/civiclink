import { CircleHelp, KeyRound, LockKeyhole, LogIn, Mail } from "lucide-react";
import { useState } from "react";
import api from "../api/api";
import { useWorkerI18n } from "../i18n";
import { setAuth } from "../utils/auth";

export default function Login({ onLoggedIn }) {
  const { t } = useWorkerI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [helpLoading, setHelpLoading] = useState(false);
  const [error, setError] = useState("");
  const [helpPanel, setHelpPanel] = useState(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError(t("login.error.required"));
      return;
    }

    setError("");
    setHelpPanel(null);
    setLoading(true);

    try {
      const res = await api.post("/auth/worker/login", {
        email: email.trim(),
        password,
      });
      setAuth(res.data);
      onLoggedIn(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || t("login.error.failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError(t("login.error.helpEmail"));
      return;
    }

    setError("");
    setHelpPanel(null);
    setHelpLoading(true);

    try {
      const res = await api.post("/auth/forgot-password/lookup", { email: email.trim() });
      const data = res.data?.data;

      if (data?.flow === "WORKER_CONTACT") {
        setHelpPanel({
          title: t("login.help.title"),
          message: data.message,
          departmentName: data.department_name,
          contactPhone: data.contact_phone,
        });
        return;
      }

      if (data?.flow === "DEPT_ADMIN_REQUEST") {
        setError(t("login.help.adminPortal"));
        return;
      }

      setError(data?.message || t("login.help.unavailable"));
    } catch (err) {
      setError(err?.response?.data?.message || t("login.error.helpFlow"));
    } finally {
      setHelpLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      handleLogin();
    }
  };

  return (
    <div className="worker-auth-shell">
      <div className="worker-auth-card">
        <div className="worker-brand worker-brand-auth">
          <div className="worker-brand-icon">C</div>
          <div className="worker-brand-copy notranslate" translate="no">
            <div className="worker-brand-name">{t("portal.brand")}</div>
            <div className="worker-brand-sub">{t("portal.worker")}</div>
          </div>
        </div>

        <div className="worker-auth-kicker">{t("portal.fieldOperations")}</div>
        <h1>{t("login.heading")}</h1>
        <p className="worker-auth-copy">{t("login.subtitle")}</p>

        {error ? <div className="worker-alert worker-alert-error">{error}</div> : null}

        <div className="worker-auth-body">
          <div className="worker-stack">
            <label className="worker-label" htmlFor="worker-email">{t("login.emailLabel")}</label>
            <div className="worker-input-with-icon">
              <Mail size={18} aria-hidden="true" />
              <input
                id="worker-email"
                className="worker-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("login.emailPlaceholder")}
              />
            </div>
          </div>

          <div className="worker-stack">
            <label className="worker-label" htmlFor="worker-password">{t("login.passwordLabel")}</label>
            <div className="worker-input-with-icon">
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                id="worker-password"
                className="worker-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("login.passwordPlaceholder")}
              />
            </div>
          </div>

          <div className="worker-auth-actions">
            <button
              type="button"
              className="worker-primary-btn worker-btn-with-icon"
              onClick={handleLogin}
              disabled={loading}
            >
              <LogIn size={18} aria-hidden="true" />
              <span>{loading ? t("login.signingIn") : t("login.signIn")}</span>
            </button>

            <button
              type="button"
              className="worker-link-btn worker-link-btn-icon"
              onClick={handleForgotPassword}
              disabled={helpLoading}
            >
              {helpLoading ? (
                <>
                  <KeyRound size={16} aria-hidden="true" />
                  <span>{t("login.checkingAccount")}</span>
                </>
              ) : (
                <>
                  <CircleHelp size={16} aria-hidden="true" />
                  <span>{t("login.passwordHelp")}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {helpPanel ? (
          <div className="worker-alert worker-alert-info">
            <div className="worker-help-title">{helpPanel.title}</div>
            <p>{helpPanel.message}</p>
            <div className="worker-help-meta">
              <span>{helpPanel.departmentName}</span>
              {helpPanel.contactPhone ? <span>{helpPanel.contactPhone}</span> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
