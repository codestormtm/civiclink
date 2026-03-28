import { useState } from "react";
import api from "../api/api";
import { setAuth } from "../utils/auth";

export default function Login({ setLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", { email, password });
      setAuth(res.data);
      setLoggedIn(true);
    } catch (err) {
      setError(err?.response?.data?.error || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") login();
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">CivicLink</div>
        <p className="login-subtitle">Admin Portal</p>

        {error && <div className="login-error">{error}</div>}

        <input
          className="login-input"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKey}
        />

        <input
          className="login-input"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKey}
        />

        <button className="login-btn" onClick={login} disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </div>
  );
}
