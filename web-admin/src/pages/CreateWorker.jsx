import { useState } from "react";
import api from "../api/api";

export default function CreateWorker() {
  const [form, setForm] = useState({ employment_status: "ACTIVE" });
  const [profile, setProfile] = useState(null);
  const [nic, setNic] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const field = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async () => {
    if (!form.full_name || !form.email || !form.password || !form.nic_number) {
      setError("Full Name, Email, Password, and NIC Number are required.");
      return;
    }

    setError("");
    setLoading(true);
    setSuccess(false);

    try {
      const data = new FormData();
      Object.keys(form).forEach((key) => data.append(key, form[key]));
      if (profile) data.append("profile_picture", profile);
      if (nic) data.append("nic_copy", nic);

      await api.post("/workers", data);

      setSuccess(true);
      setForm({ employment_status: "ACTIVE" });
      setProfile(null);
      setNic(null);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create worker.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <p className="section-title">Create Department Worker</p>

      {success && (
        <div className="toast toast-success">
          Worker created successfully!
        </div>
      )}

      {error && (
        <div className="toast toast-error">{error}</div>
      )}

      <div className="form-card">
        <div className="form-grid">
          <div className="form-group">
            <label>Full Name *</label>
            <input placeholder="John Silva" value={form.full_name || ""} onChange={field("full_name")} />
          </div>

          <div className="form-group">
            <label>Email *</label>
            <input placeholder="john@example.com" type="email" value={form.email || ""} onChange={field("email")} />
          </div>

          <div className="form-group">
            <label>Password *</label>
            <input placeholder="Password" type="password" value={form.password || ""} onChange={field("password")} />
          </div>

          <div className="form-group">
            <label>NIC Number *</label>
            <input placeholder="123456789V" value={form.nic_number || ""} onChange={field("nic_number")} />
          </div>

          <div className="form-group">
            <label>Name Initials</label>
            <input placeholder="J.A. Silva" value={form.name_initials || ""} onChange={field("name_initials")} />
          </div>

          <div className="form-group">
            <label>Designation</label>
            <input placeholder="Field Officer" value={form.designation || ""} onChange={field("designation")} />
          </div>

          <div className="form-group">
            <label>Employment Type</label>
            <select value={form.employment_type || ""} onChange={field("employment_type")}>
              <option value="">Select type</option>
              <option value="Permanent">Permanent</option>
              <option value="Casual">Casual</option>
              <option value="Contract">Contract</option>
            </select>
          </div>

          <div className="form-group">
            <label>Employment Status</label>
            <select value={form.employment_status || "ACTIVE"} onChange={field("employment_status")}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </div>

          <div className="form-group">
            <label>Address</label>
            <input placeholder="Worker address" value={form.address || ""} onChange={field("address")} />
          </div>

          <div className="form-group">
            <label>Appointment Date</label>
            <input type="date" value={form.date_of_appointment || ""} onChange={field("date_of_appointment")} />
          </div>

          <div className="form-group">
            <label>Previous Employer</label>
            <input placeholder="Previous employer" value={form.previous_employer || ""} onChange={field("previous_employer")} />
          </div>

          <div className="form-group">
            <label>Salary</label>
            <input placeholder="50000" type="number" value={form.salary || ""} onChange={field("salary")} />
          </div>

          <div className="form-group">
            <label>Bank Name</label>
            <input placeholder="Bank name" value={form.bank_name || ""} onChange={field("bank_name")} />
          </div>

          <div className="form-group">
            <label>Account Number</label>
            <input placeholder="Account number" value={form.account_number || ""} onChange={field("account_number")} />
          </div>

          <div className="form-group">
            <label>IBAN</label>
            <input placeholder="IBAN" value={form.iban || ""} onChange={field("iban")} />
          </div>

          <div className="form-group">
            <label>Profile Picture</label>
            <input type="file" accept="image/*" onChange={(e) => setProfile(e.target.files[0])} />
          </div>

          <div className="form-group">
            <label>NIC Copy</label>
            <input type="file" accept="image/*,.pdf" onChange={(e) => setNic(e.target.files[0])} />
          </div>
        </div>

        <button className="btn-primary" onClick={submit} disabled={loading}>
          {loading ? "Creating..." : "Create Worker"}
        </button>
      </div>
    </div>
  );
}
