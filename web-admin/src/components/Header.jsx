import { useState } from "react";
import api from "../api/api";

const INITIAL_FORM = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

export default function Header() {
  const name = localStorage.getItem("name");
  const role = localStorage.getItem("role");
  const department = localStorage.getItem("department");

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [saving, setSaving] = useState(false);

  const logout = () => {
    localStorage.clear();
    window.location.reload();
  };

  const submitChangePassword = async () => {
    if (!form.current_password || !form.new_password || !form.confirm_password) {
      setMessage({ type: "error", text: "Fill in all password fields." });
      return;
    }

    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const res = await api.post("/dept-admin/change-password", form);
      setMessage({ type: "success", text: res.data.message || "Password changed successfully." });
      setForm(INITIAL_FORM);
      window.setTimeout(() => {
        setShowChangePassword(false);
        setMessage({ type: "", text: "" });
      }, 1200);
    } catch (err) {
      setMessage({
        type: "error",
        text: err?.response?.data?.message || "Failed to change password.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">
          CivicLink {department ? `| ${department}` : ""}
        </div>

        <div className="topbar-right">
          <span className="topbar-role">{role}</span>
          <span className="topbar-name">{name}</span>
          <button className="topbar-action" onClick={() => setShowChangePassword(true)}>
            Change Password
          </button>
          <button className="topbar-logout" onClick={logout}>Logout</button>
        </div>
      </div>

      {showChangePassword && (
        <div className="modal-backdrop" onClick={() => setShowChangePassword(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Change Password</h3>
            <p className="modal-copy">
              Enter your current password and the new password you want to use for the department admin portal.
            </p>

            {message.text && (
              <div className={`toast ${message.type === "error" ? "toast-error" : "toast-success"}`}>
                {message.text}
              </div>
            )}

            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                value={form.current_password}
                onChange={(e) => setForm((prev) => ({ ...prev, current_password: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={form.new_password}
                onChange={(e) => setForm((prev) => ({ ...prev, new_password: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={form.confirm_password}
                onChange={(e) => setForm((prev) => ({ ...prev, confirm_password: e.target.value }))}
              />
            </div>

            <div className="modal-actions">
              <button className="btn-primary" onClick={submitChangePassword} disabled={saving}>
                {saving ? "Saving..." : "Update Password"}
              </button>
              <button
                className="topbar-logout"
                onClick={() => {
                  setShowChangePassword(false);
                  setForm(INITIAL_FORM);
                  setMessage({ type: "", text: "" });
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
