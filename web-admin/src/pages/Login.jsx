import { useState } from "react";
import api from "../api/api";
import { setAuth } from "../utils/auth";

const INITIAL_REQUEST_FORM = {
  email: "",
  target_name: "",
  nic_number: "",
  mobile_number: "",
  target_role: "DEPT_ADMIN",
};

export default function Login({ setLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [showForgotForm, setShowForgotForm] = useState(false);
  const [requestLetter, setRequestLetter] = useState(null);
  const [requestForm, setRequestForm] = useState(INITIAL_REQUEST_FORM);

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
      setError(err?.response?.data?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const resetForgotPasswordState = () => {
    setForgotError("");
    setForgotSuccess("");
  };

  const startForgotPassword = async () => {
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }

    resetForgotPasswordState();
    setForgotLoading(true);

    try {
      const res = await api.post("/auth/forgot-password/lookup", { email: email.trim() });
      const data = res.data.data;

      setRequestForm((prev) => ({
        ...prev,
        email: email.trim(),
      }));

      if (data.flow === "WORKER_CONTACT") {
        setShowForgotForm(false);
        setForgotError("Worker accounts must use the worker portal for password help.");
        return;
      }

      if (data.flow === "DEPT_ADMIN_REQUEST") {
        setShowForgotForm(true);
        return;
      }

      setShowForgotForm(false);
      setForgotError(data.message || "Forgot password is not available for this account.");
    } catch (err) {
      setShowForgotForm(false);
      setForgotError(err?.response?.data?.message || "Failed to start the forgot password flow.");
    } finally {
      setForgotLoading(false);
    }
  };

  const submitDeptAdminRequest = async () => {
    if (
      !requestForm.email ||
      !requestForm.target_name ||
      !requestForm.nic_number ||
      !requestForm.mobile_number ||
      !requestLetter
    ) {
      setForgotError("Complete all fields and upload the signed request letter.");
      return;
    }

    resetForgotPasswordState();
    setForgotLoading(true);

    try {
      const formData = new FormData();
      formData.append("email", requestForm.email.trim());
      formData.append("target_name", requestForm.target_name.trim());
      formData.append("nic_number", requestForm.nic_number.trim());
      formData.append("mobile_number", requestForm.mobile_number.trim());
      formData.append("target_role", requestForm.target_role);
      formData.append("request_letter", requestLetter);

      await api.post("/auth/forgot-password/dept-admin-request", formData);

      setForgotSuccess("Your password reset request was sent to the system admin mailbox.");
      setShowForgotForm(false);
      setRequestLetter(null);
      setRequestForm({
        ...INITIAL_REQUEST_FORM,
        email: email.trim(),
      });
    } catch (err) {
      setForgotError(err?.response?.data?.message || "Failed to submit the password reset request.");
    } finally {
      setForgotLoading(false);
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
        {forgotError && <div className="login-error">{forgotError}</div>}
        {forgotSuccess && <div className="toast toast-success" style={{ marginBottom: 16 }}>{forgotSuccess}</div>}

        <input
          className="login-input"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setRequestForm((prev) => ({ ...prev, email: e.target.value }));
          }}
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

        <button
          type="button"
          className="login-link-btn"
          onClick={startForgotPassword}
          disabled={forgotLoading}
        >
          {forgotLoading ? "Checking account..." : "Forgot password?"}
        </button>

        {showForgotForm && (
          <div className="login-forgot-panel">
            <div className="login-forgot-title">Department Admin Password Reset</div>
            <p className="login-forgot-copy">
              Submit the official details below. The system admin will review the request in the mailbox dashboard.
            </p>

            <div className="form-group">
              <label>Used Email Address</label>
              <input
                className="login-input"
                type="email"
                value={requestForm.email}
                onChange={(e) => setRequestForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Who Needs Password Reset</label>
              <input
                className="login-input"
                value={requestForm.target_name}
                onChange={(e) => setRequestForm((prev) => ({ ...prev, target_name: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>NIC Number</label>
              <input
                className="login-input"
                value={requestForm.nic_number}
                onChange={(e) => setRequestForm((prev) => ({ ...prev, nic_number: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Mobile Number</label>
              <input
                className="login-input"
                value={requestForm.mobile_number}
                onChange={(e) => setRequestForm((prev) => ({ ...prev, mobile_number: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Role in Department</label>
              <input className="login-input" value="DEPT_ADMIN" disabled readOnly />
            </div>

            <div className="form-group">
              <label>Signed Request Letter</label>
              <input
                className="login-input"
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setRequestLetter(e.target.files?.[0] || null)}
              />
            </div>

            <div className="login-forgot-actions">
              <button className="btn-primary" onClick={submitDeptAdminRequest} disabled={forgotLoading}>
                {forgotLoading ? "Submitting..." : "Submit Request"}
              </button>
              <button
                type="button"
                className="topbar-logout"
                onClick={() => {
                  setShowForgotForm(false);
                  resetForgotPasswordState();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
