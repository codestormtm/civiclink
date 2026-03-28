import { useEffect, useState } from "react";
import api from "../api/api";
import { getDepartment } from "../utils/auth";
import { printHtmlDocument } from "../utils/print";
import { buildTerminationLetterPrintHtml } from "../utils/printTemplates";

const EMPTY_FORM = { employment_status: "ACTIVE" };
const EMPTY_REMOVAL_FORM = {
  admin_password: "",
  decision_statement:
    "This letter serves as formal notice that your employment with CivicLink is being terminated effective immediately.",
  termination_reason: "",
  final_compensation_details: "",
  property_return_checklist: "",
};

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [profileFile, setProfileFile] = useState(null);
  const [nicFile, setNicFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [generatedLetter, setGeneratedLetter] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const [removingId, setRemovingId] = useState(null);
  const [removalForm, setRemovalForm] = useState(EMPTY_REMOVAL_FORM);
  const [removing, setRemoving] = useState(false);
  const [removalError, setRemovalError] = useState("");

  const field = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const editField = (key) => (e) => setEditForm((f) => ({ ...f, [key]: e.target.value }));
  const removalField = (key) => (e) => setRemovalForm((f) => ({ ...f, [key]: e.target.value }));

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function fetchWorkers() {
    try {
      const res = await api.get("/workers");
      setWorkers(res.data.data);
    } catch {
      // silently keep list empty
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWorkers();
  }, []);

  async function handleSubmit() {
    if (!form.full_name || !form.email || !form.password || !form.nic_number) {
      showToast("error", "Full Name, Email, Password and NIC Number are required.");
      return;
    }

    setSubmitting(true);

    try {
      const data = new FormData();
      Object.keys(form).forEach((k) => data.append(k, form[k]));
      if (profileFile) data.append("profile_picture", profileFile);
      if (nicFile) data.append("nic_copy", nicFile);

      await api.post("/workers", data);

      showToast("success", "Worker created successfully.");
      setForm(EMPTY_FORM);
      setProfileFile(null);
      setNicFile(null);
      setShowForm(false);
      fetchWorkers();
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to create worker.");
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(worker) {
    setRemovingId(null);
    setEditingId(worker.id);
    setEditForm({
      full_name: worker.full_name || worker.name || "",
      name_initials: worker.name_initials || "",
      designation: worker.designation || "",
      employment_type: worker.employment_type || "",
      employment_status: worker.employment_status || "ACTIVE",
      address: worker.address || "",
      salary: worker.salary || "",
      date_of_appointment: worker.date_of_appointment
        ? worker.date_of_appointment.slice(0, 10)
        : "",
      bank_name: worker.bank_name || "",
      account_number: worker.account_number || "",
      iban: worker.iban || "",
    });
  }

  function openRemove(worker) {
    setEditingId(null);
    setRemovingId(worker.id);
    setRemovalError("");
    setRemovalForm({
      ...EMPTY_REMOVAL_FORM,
      decision_statement:
        "This letter serves as formal notice that your employment with CivicLink is being terminated effective immediately.",
    });
  }

  async function handleUpdate(workerId) {
    if (!editForm.full_name) {
      showToast("error", "Full Name is required.");
      return;
    }

    setSaving(true);

    try {
      await api.patch(`/workers/${workerId}`, editForm);
      showToast("success", "Worker updated successfully.");
      setEditingId(null);
      fetchWorkers();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to update worker.");
    } finally {
      setSaving(false);
    }
  }

  function buildLetterPreview(worker) {
    const workerName = worker.full_name || worker.name;
    const formattedDate = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    return [
      "FORMAL TERMINATION LETTER",
      "",
      `Date: ${formattedDate}`,
      `Department: ${worker.department_name || "-"}`,
      `Employee: ${workerName}`,
      "",
      `Dear ${workerName},`,
      "",
      removalForm.decision_statement || "[Decision statement]",
      "",
      `Reason: ${removalForm.termination_reason || "[Reason]"}`,
      "",
      `Final Compensation: ${removalForm.final_compensation_details || "[Final compensation details]"}`,
      "",
      `Property Return Checklist: ${removalForm.property_return_checklist || "[Property return checklist]"}`,
    ].join("\n");
  }

  async function handleRemove(workerId) {
    if (
      !removalForm.admin_password ||
      !removalForm.decision_statement ||
      !removalForm.termination_reason ||
      !removalForm.final_compensation_details ||
      !removalForm.property_return_checklist
    ) {
      const message = "Complete the termination letter and enter the department admin password.";
      setRemovalError(message);
      showToast("error", message);
      return;
    }

    setRemoving(true);
    setRemovalError("");

    try {
      const res = await api.post(`/workers/${workerId}/remove`, removalForm);
      const removed = res.data.data;

      setGeneratedLetter({
        worker_name: removed.worker_name,
        terminated_at: removed.terminated_at,
        letter_body: removed.letter_body,
      });
      showToast("success", `${removed.worker_name} was removed successfully.`);
      setRemovingId(null);
      setRemovalForm(EMPTY_REMOVAL_FORM);
      fetchWorkers();
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Failed to remove worker.";
      setRemovalError(message);
      showToast("error", message);
    } finally {
      setRemoving(false);
    }
  }

  const handlePrintTerminationLetter = () => {
    if (!generatedLetter?.letter_body) return;

    const html = buildTerminationLetterPrintHtml({
      letterBody: generatedLetter.letter_body,
      departmentName: getDepartment(),
      terminatedAt: generatedLetter.terminated_at,
      workerName: generatedLetter.worker_name,
    });

    printHtmlDocument({
      title: "Termination Letter",
      html,
    });
  };

  const statusColor = (status) => {
    if (status === "ACTIVE") return "resolved";
    if (status === "SUSPENDED") return "inprogress";
    return "assigned";
  };

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    fontSize: 13,
    border: "1px solid #d1d5db",
    borderRadius: 7,
    fontFamily: "inherit",
    background: "#fff",
    boxSizing: "border-box",
  };

  const labelStyle = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: "#6b7280",
    marginBottom: 4,
    textTransform: "uppercase",
  };

  return (
    <div className="container">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <p className="section-title" style={{ marginBottom: 0 }}>
          Workers
        </p>
        <button
          className="btn-primary"
          onClick={() => {
            setShowForm((v) => !v);
            setToast(null);
            setEditingId(null);
            setRemovingId(null);
          }}
        >
          {showForm ? "Cancel" : "+ Add Worker"}
        </button>
      </div>

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {generatedLetter && (
        <div
          className="form-card"
          style={{ marginBottom: 24, border: "1px solid #bbf7d0", background: "#f0fdf4" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#166534", marginBottom: 6 }}>
                Termination Letter Generated
              </p>
              <p style={{ fontSize: 12, color: "#166534", marginBottom: 0 }}>
                {generatedLetter.worker_name} was removed from the active worker list.
              </p>
            </div>
            <button
              onClick={() => setGeneratedLetter(null)}
              style={{
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 600,
                background: "#fff",
                color: "#166534",
                border: "1px solid #86efac",
                borderRadius: 7,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Close
            </button>
          </div>

          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={handlePrintTerminationLetter}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 700,
                background: "#1a56db",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Print Termination Letter
            </button>
          </div>

          <div
            style={{
              marginTop: 14,
              padding: "14px 16px",
              background: "#fff",
              border: "1px solid #dcfce7",
              borderRadius: 10,
            }}
          >
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontSize: 12,
                lineHeight: 1.7,
                color: "#14532d",
                fontFamily: "inherit",
              }}
            >
              {generatedLetter.letter_body}
            </pre>
          </div>
        </div>
      )}

      {showForm && (
        <div className="form-card" style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 18 }}>
            New Worker
          </p>
          <div className="form-grid">
            <div className="form-group">
              <label>Full Name *</label>
              <input placeholder="John Silva" value={form.full_name || ""} onChange={field("full_name")} />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input type="email" placeholder="john@example.com" value={form.email || ""} onChange={field("email")} />
            </div>
            <div className="form-group">
              <label>Password *</label>
              <input type="password" placeholder="Password" value={form.password || ""} onChange={field("password")} />
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
              <select value={form.employment_status} onChange={field("employment_status")}>
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
              <input type="number" placeholder="50000" value={form.salary || ""} onChange={field("salary")} />
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
            <div className="form-group" />
            <div className="form-group">
              <label>Profile Picture</label>
              <input type="file" accept="image/*" onChange={(e) => setProfileFile(e.target.files[0])} />
            </div>
            <div className="form-group">
              <label>NIC Copy</label>
              <input type="file" accept="image/*,.pdf" onChange={(e) => setNicFile(e.target.files[0])} />
            </div>
          </div>
          <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating..." : "Create Worker"}
          </button>
        </div>
      )}

      {loading && <p className="empty">Loading...</p>}
      {!loading && workers.length === 0 && <p className="empty">No workers found.</p>}

      {workers.map((worker) => {
        const isEditing = editingId === worker.id;
        const isRemoving = removingId === worker.id;

        return (
          <div className="card" key={worker.id}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "#eff6ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 16,
                  color: "#1a56db",
                  flexShrink: 0,
                }}
              >
                {(worker.full_name || worker.name || "?")[0].toUpperCase()}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <h3 style={{ margin: 0 }}>{worker.full_name || worker.name}</h3>
                  <span className={`badge ${statusColor(worker.employment_status)}`}>
                    {worker.employment_status}
                  </span>
                </div>
                <p style={{ marginBottom: 4 }}>{worker.email}</p>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {worker.designation && (
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{worker.designation}</span>
                  )}
                  {worker.employment_type && (
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{worker.employment_type}</span>
                  )}
                  {worker.department_name && (
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{worker.department_name}</span>
                  )}
                  {worker.nic_number && (
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>NIC: {worker.nic_number}</span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => (isEditing ? setEditingId(null) : openEdit(worker))}
                  style={{
                    padding: "5px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    background: isEditing ? "#f3f4f6" : "#eff6ff",
                    color: isEditing ? "#6b7280" : "#1a56db",
                    border: `1px solid ${isEditing ? "#d1d5db" : "#93c5fd"}`,
                    borderRadius: 7,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {isEditing ? "Cancel" : "Edit"}
                </button>
                <button
                  onClick={() => (isRemoving ? setRemovingId(null) : openRemove(worker))}
                  style={{
                    padding: "5px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    background: isRemoving ? "#fef2f2" : "#fff",
                    color: "#dc2626",
                    border: "1px solid #fca5a5",
                    borderRadius: 7,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {isRemoving ? "Cancel Remove" : "Remove Worker"}
                </button>
              </div>
            </div>

            {isEditing && (
              <div
                style={{
                  marginTop: 16,
                  padding: "16px",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                }}
              >
                <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#374151" }}>
                  Edit Worker Details
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: 14,
                  }}
                >
                  <div>
                    <label style={labelStyle}>Full Name *</label>
                    <input style={inputStyle} value={editForm.full_name} onChange={editField("full_name")} />
                  </div>
                  <div>
                    <label style={labelStyle}>Name Initials</label>
                    <input
                      style={inputStyle}
                      value={editForm.name_initials}
                      onChange={editField("name_initials")}
                      placeholder="J.A. Silva"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Designation</label>
                    <input
                      style={inputStyle}
                      value={editForm.designation}
                      onChange={editField("designation")}
                      placeholder="Field Officer"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Employment Type</label>
                    <select style={inputStyle} value={editForm.employment_type} onChange={editField("employment_type")}>
                      <option value="">Select type</option>
                      <option value="Permanent">Permanent</option>
                      <option value="Casual">Casual</option>
                      <option value="Contract">Contract</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Employment Status</label>
                    <select style={inputStyle} value={editForm.employment_status} onChange={editField("employment_status")}>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Address</label>
                    <input
                      style={inputStyle}
                      value={editForm.address}
                      onChange={editField("address")}
                      placeholder="Worker address"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Salary</label>
                    <input
                      style={inputStyle}
                      type="number"
                      value={editForm.salary}
                      onChange={editField("salary")}
                      placeholder="50000"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Appointment Date</label>
                    <input
                      style={inputStyle}
                      type="date"
                      value={editForm.date_of_appointment}
                      onChange={editField("date_of_appointment")}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Bank Name</label>
                    <input
                      style={inputStyle}
                      value={editForm.bank_name}
                      onChange={editField("bank_name")}
                      placeholder="Bank name"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Account Number</label>
                    <input
                      style={inputStyle}
                      value={editForm.account_number}
                      onChange={editField("account_number")}
                      placeholder="Account number"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>IBAN</label>
                    <input
                      style={inputStyle}
                      value={editForm.iban}
                      onChange={editField("iban")}
                      placeholder="IBAN"
                    />
                  </div>
                </div>

                <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                  <button
                    onClick={() => handleUpdate(worker.id)}
                    disabled={saving}
                    style={{
                      padding: "9px 24px",
                      fontSize: 13,
                      fontWeight: 700,
                      background: saving ? "#9ca3af" : "#1a56db",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      cursor: saving ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    style={{
                      padding: "9px 20px",
                      fontSize: 13,
                      fontWeight: 600,
                      background: "#fff",
                      color: "#6b7280",
                      border: "1px solid #d1d5db",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {isRemoving && (
              <div
                style={{
                  marginTop: 16,
                  padding: "16px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 10,
                }}
              >
                <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#991b1b" }}>
                  Formal Termination Letter
                </p>
                <p style={{ margin: "0 0 14px", fontSize: 12, color: "#991b1b", lineHeight: 1.6 }}>
                  Fill the official termination details below. The worker will be removed from the active portal only after the department admin password is confirmed. Historical records stay intact.
                </p>

                {removalError && (
                  <div
                    style={{
                      marginBottom: 14,
                      padding: "10px 12px",
                      background: "#fff1f2",
                      border: "1px solid #fecdd3",
                      borderRadius: 8,
                      color: "#be123c",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {removalError}
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                    gap: 14,
                  }}
                >
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>The Decision *</label>
                    <textarea
                      style={{ ...inputStyle, minHeight: 84, resize: "vertical" }}
                      value={removalForm.decision_statement}
                      onChange={removalField("decision_statement")}
                      placeholder="State clearly that employment is being terminated."
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>The Reason *</label>
                    <textarea
                      style={{ ...inputStyle, minHeight: 84, resize: "vertical" }}
                      value={removalForm.termination_reason}
                      onChange={removalField("termination_reason")}
                      placeholder="Briefly explain the reason for termination."
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Final Compensation *</label>
                    <textarea
                      style={{ ...inputStyle, minHeight: 84, resize: "vertical" }}
                      value={removalForm.final_compensation_details}
                      onChange={removalField("final_compensation_details")}
                      placeholder="Describe final paycheck, unused leave, severance, or other compensation."
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Property Return Checklist *</label>
                    <textarea
                      style={{ ...inputStyle, minHeight: 84, resize: "vertical" }}
                      value={removalForm.property_return_checklist}
                      onChange={removalField("property_return_checklist")}
                      placeholder="List items such as laptop, ID badge, keys, uniforms, devices, and files."
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Department Admin Password *</label>
                    <input
                      style={inputStyle}
                      type="password"
                      value={removalForm.admin_password}
                      onChange={removalField("admin_password")}
                      placeholder="Confirm your password to remove this worker"
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 16,
                    padding: "14px 16px",
                    background: "#fff",
                    border: "1px solid #fee2e2",
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#9f1239",
                      marginBottom: 8,
                      textTransform: "uppercase",
                    }}
                  >
                    Letter Preview
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      fontSize: 12,
                      lineHeight: 1.7,
                      color: "#4b5563",
                      fontFamily: "inherit",
                    }}
                  >
                    {buildLetterPreview(worker)}
                  </pre>
                </div>

                <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                  <button
                    onClick={() => handleRemove(worker.id)}
                    disabled={removing}
                    style={{
                      padding: "9px 22px",
                      fontSize: 13,
                      fontWeight: 700,
                      background: removing ? "#fca5a5" : "#dc2626",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      cursor: removing ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {removing ? "Removing..." : "Confirm Remove Worker"}
                  </button>
                  <button
                    onClick={() => setRemovingId(null)}
                    style={{
                      padding: "9px 20px",
                      fontSize: 13,
                      fontWeight: 600,
                      background: "#fff",
                      color: "#6b7280",
                      border: "1px solid #d1d5db",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
