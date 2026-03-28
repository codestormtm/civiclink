import { useState } from "react";
import api from "../api/api";
import { setAuth } from "../utils/auth";

export default function Login({ setLoggedIn }) {
  const [tab, setTab] = useState("login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setError("");
      setLoading(true);
      const res = await api.post("/auth/login", loginForm);
      setAuth(res.data);
      setLoggedIn(true);
    } catch (err) {
      setError(err?.response?.data?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    try {
      setError("");
      setSuccess("");
      setLoading(true);
      await api.post("/auth/register", regForm);
      setSuccess("Account created! You can now sign in.");
      setRegForm({ name: "", email: "", password: "" });
      setTimeout(() => setTab("login"), 1400);
    } catch (err) {
      setError(err?.response?.data?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") tab === "login" ? handleLogin() : handleRegister();
  };

  return (
    <div className="auth-page">
      <div className="auth-gov-header">
        <div className="auth-gov-title">Government of Sri Lanka — CivicLink</div>
      </div>

      <div className="auth-card">
        {/* Tab switcher */}
        <div style={{
          display: "flex",
          background: "#f3f4f6",
          borderRadius: 10,
          padding: 4,
          marginBottom: 24,
          gap: 4,
        }}>
          {[
            { key: "login", label: "Sign In" },
            { key: "register", label: "Create Account" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setError(""); setSuccess(""); }}
              style={{
                flex: 1,
                padding: "9px 0",
                border: "none",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
                background: tab === t.key ? "#ffffff" : "transparent",
                color: tab === t.key ? "#1a56db" : "#6b7280",
                boxShadow: tab === t.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                fontFamily: "inherit",
                width: "auto",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {tab === "login" ? (
          <>
            <input
              className="auth-input"
              type="email"
              placeholder="Email address"
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              onKeyDown={handleKey}
            />
            <input
              className="auth-input"
              type="password"
              placeholder="Password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              onKeyDown={handleKey}
            />
            <button className="auth-btn" onClick={handleLogin} disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </>
        ) : (
          <>
            <input
              className="auth-input"
              type="text"
              placeholder="Full name"
              value={regForm.name}
              onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
              onKeyDown={handleKey}
            />
            <input
              className="auth-input"
              type="email"
              placeholder="Email address"
              value={regForm.email}
              onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
              onKeyDown={handleKey}
            />
            <input
              className="auth-input"
              type="password"
              placeholder="Create a password"
              value={regForm.password}
              onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
              onKeyDown={handleKey}
            />
            <button className="auth-btn" onClick={handleRegister} disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </>
        )}

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: "#9ca3af" }}>
          By continuing you agree to the{" "}
          <span style={{ color: "#1a56db" }}>Terms of Service</span>
        </div>
      </div>
    </div>
  );
}
