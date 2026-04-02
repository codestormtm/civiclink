import { CircleHelp, KeyRound, Languages, LockKeyhole, LogIn, Mail } from "lucide-react";
import { useState } from "react";
import api from "../api/api";
import LanguageSelector from "../components/LanguageSelector";
import { setAuth } from "../utils/auth";

export default function Login({ onLoggedIn, language, onLanguageChange }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [helpLoading, setHelpLoading] = useState(false);
  const [error, setError] = useState("");
  const [helpPanel, setHelpPanel] = useState(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password to continue.");
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
      onLoggedIn();
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to sign in to the worker portal.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("Enter your work email address first.");
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
          title: "Password help from your department",
          message: data.message,
          departmentName: data.department_name,
          contactPhone: data.contact_phone,
        });
        return;
      }

      if (data?.flow === "DEPT_ADMIN_REQUEST") {
        setError("This account belongs to the admin portal. Use the admin portal for password help.");
        return;
      }

      setError(data?.message || "Password help is not available for this account.");
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to start the password help flow.");
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
        <div className="worker-auth-toolbar notranslate" translate="no">
          <div className="worker-toolbar-label">
            <Languages size={16} aria-hidden="true" />
            <span>Language</span>
          </div>
          <LanguageSelector value={language} onChange={onLanguageChange} />
        </div>

        <div className="worker-brand worker-brand-auth">
          <div className="worker-brand-icon">C</div>
          <div className="worker-brand-copy notranslate" translate="no">
            <div className="worker-brand-name">CivicLink</div>
            <div className="worker-brand-sub">Worker Portal</div>
          </div>
        </div>

        <div className="worker-auth-kicker">Field Operations Workspace</div>
        <h1>Sign in to continue field work</h1>
        <p className="worker-auth-copy">
          Manage assigned complaints, upload evidence, and update progress from a mobile-ready CivicLink workspace.
        </p>

        {error && <div className="worker-alert worker-alert-error">{error}</div>}

        <div className="worker-auth-body">
          <div className="worker-stack">
            <label className="worker-label" htmlFor="worker-email">Work Email</label>
            <div className="worker-input-with-icon">
              <Mail size={18} aria-hidden="true" />
              <input
                id="worker-email"
                className="worker-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="worker@department.gov.lk"
              />
            </div>
          </div>

          <div className="worker-stack">
            <label className="worker-label" htmlFor="worker-password">Password</label>
            <div className="worker-input-with-icon">
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                id="worker-password"
                className="worker-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your password"
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
              <span>{loading ? "Signing in..." : "Sign In"}</span>
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
                  <span>Checking account...</span>
                </>
              ) : (
                <>
                  <CircleHelp size={16} aria-hidden="true" />
                  <span>Need password help?</span>
                </>
              )}
            </button>
          </div>
        </div>

        {helpPanel && (
          <div className="worker-alert worker-alert-info">
            <div className="worker-help-title">{helpPanel.title}</div>
            <p>{helpPanel.message}</p>
            <div className="worker-help-meta">
              <span>{helpPanel.departmentName}</span>
              {helpPanel.contactPhone && <span>{helpPanel.contactPhone}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
