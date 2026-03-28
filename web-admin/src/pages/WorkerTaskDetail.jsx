import { useCallback, useEffect, useState } from "react";
import api from "../api/api";
import StatusBadge from "../components/StatusBadge";
import ComplaintTimeline from "../components/ComplaintTimeline";

export default function WorkerTaskDetail({ taskId, goBack }) {
  const [data, setData] = useState(null);
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState({ text: "", type: "" });

  const fetchTask = useCallback(async () => {
    try {
      const res = await api.get(`/worker/assignments/${taskId}`);
      setData(res.data.data);
    } catch {
      setMessage({ text: "Failed to load task details", type: "error" });
    }
  }, [taskId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get(`/worker/assignments/${taskId}`);
        if (active) setData(res.data.data);
      } catch {
        if (active) setMessage({ text: "Failed to load task details", type: "error" });
      }
    })();
    return () => { active = false; };
  }, [taskId]);

  const updateStatus = async (status) => {
    try {
      await api.patch(`/worker/assignments/${taskId}/status`, { status, note });
      setMessage({ text: `Status updated to ${status.replace("_", " ")}`, type: "success" });
      setNote("");
      fetchTask();
    } catch (err) {
      setMessage({ text: err?.response?.data?.error || "Failed to update status", type: "error" });
    }
  };

  const uploadEvidence = async () => {
    if (!file) {
      setMessage({ text: "Please choose a file first", type: "error" });
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post(`/worker/assignments/${taskId}/attachments`, formData);
      setMessage({ text: "Evidence uploaded successfully", type: "success" });
      setFile(null);
      fetchTask();
    } catch (err) {
      setMessage({ text: err?.response?.data?.error || "Failed to upload evidence", type: "error" });
    }
  };

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: "#f3f4f6" }}>
        <div className="topbar">
          <div className="topbar-title">Task Detail</div>
          <div className="topbar-right">
            <button className="topbar-logout" onClick={goBack}>← Back</button>
          </div>
        </div>
        <div className="container">
          {message.text
            ? <div className={`toast toast-${message.type}`}>{message.text}</div>
            : <p style={{ color: "#9ca3af", fontSize: 14, padding: "24px 0" }}>Loading task...</p>
          }
        </div>
      </div>
    );
  }

  const { assignment, attachments, history } = data;
  const canStart    = assignment.complaint_status === "ASSIGNED";
  const canResolve  = assignment.complaint_status === "IN_PROGRESS";

  const hasCoords = assignment.latitude != null && assignment.longitude != null;
  const lat = parseFloat(assignment.latitude);
  const lng = parseFloat(assignment.longitude);
  const addressLabel =
    assignment.address_text && assignment.address_text !== "Current Location"
      ? assignment.address_text
      : hasCoords
      ? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
      : null;

  const fields = [
    ["Department",     assignment.department_name],
    ["Complaint Type", assignment.complaint_type],
    ["Description",    assignment.description],
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6" }}>
      {/* Topbar */}
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button className="topbar-logout" onClick={goBack}>← Back</button>
          <span className="topbar-title">{assignment.title}</span>
        </div>
        <div className="topbar-right">
          <StatusBadge status={assignment.complaint_status} />
        </div>
      </div>

      <div className="container">
        {message.text && (
          <div className={`toast toast-${message.type}`} style={{ marginBottom: 16 }}>
            {message.text}
          </div>
        )}

        {/* Complaint Details */}
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Complaint Details</h3>
          {fields.map(([label, value]) => (
            <div key={label} style={{
              display: "flex", gap: 12, padding: "8px 0",
              borderBottom: "1px solid #f3f4f6", fontSize: 13,
            }}>
              <strong style={{ minWidth: 130, color: "#111827", flexShrink: 0 }}>{label}</strong>
              <span style={{ color: "#4b5563" }}>{value || "—"}</span>
            </div>
          ))}

          {/* Location row */}
          {(addressLabel || hasCoords) && (
            <div style={{
              display: "flex", gap: 12, padding: "8px 0",
              borderBottom: "1px solid #f3f4f6", fontSize: 13,
            }}>
              <strong style={{ minWidth: 130, color: "#111827", flexShrink: 0 }}>Location</strong>
              <span style={{ color: "#4b5563", flex: 1 }}>
                {addressLabel || "—"}
                {hasCoords && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      marginLeft: 10, fontSize: 12, fontWeight: 600,
                      color: "#1a56db", textDecoration: "none",
                      background: "#eff6ff", padding: "2px 8px",
                      borderRadius: 5, whiteSpace: "nowrap",
                    }}
                  >
                    🗺 Navigate
                  </a>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Status Actions */}
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Update Work Status</h3>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Work Note (optional)</label>
            <textarea
              placeholder="Describe the work done or add a progress note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn-primary"
              style={{ width: "auto", opacity: canStart ? 1 : 0.4, cursor: canStart ? "pointer" : "not-allowed" }}
              onClick={() => canStart && updateStatus("IN_PROGRESS")}
            >
              ▶ Start Work
            </button>
            <button
              style={{
                width: "auto", padding: "9px 20px", border: "none",
                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: canResolve ? "pointer" : "not-allowed",
                background: canResolve ? "#0e9f6e" : "#d1d5db", color: canResolve ? "#fff" : "#9ca3af",
                fontFamily: "inherit",
              }}
              onClick={() => canResolve && updateStatus("RESOLVED")}
            >
              ✓ Mark Resolved
            </button>
          </div>

          {!canStart && !canResolve && (
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 10 }}>
              This task has been resolved. No further actions available.
            </p>
          )}
        </div>

        {/* Upload Evidence */}
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Upload Evidence</h3>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Photo or Document</label>
            <input type="file" onChange={(e) => setFile(e.target.files[0])} />
          </div>
          <button
            className="btn-primary"
            style={{ width: "auto" }}
            onClick={uploadEvidence}
          >
            Upload Evidence
          </button>
        </div>

        {/* Attachments */}
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Attachments</h3>
          {attachments.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9ca3af", fontStyle: "italic" }}>No attachments yet.</p>
          ) : (
            attachments.map((a) => (
              <div key={a.id} style={{ marginBottom: 8 }}>
                <a
                  href={a.file_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 13, color: "#1a56db", fontWeight: 500, textDecoration: "none" }}
                >
                  📎 View Attachment
                </a>
              </div>
            ))
          )}
        </div>

        {/* Timeline */}
        {history && history.length > 0 && (
          <div className="card">
            <ComplaintTimeline history={history} />
          </div>
        )}
      </div>
    </div>
  );
}
