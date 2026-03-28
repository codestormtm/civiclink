import { useState } from "react";
import api from "../api/api";

const STATUS_ORDER = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"];

const STATUS_META = {
  SUBMITTED:                { label: "Submitted",           color: "#1e40af", bg: "#eff6ff" },
  ASSIGNED:                 { label: "Assigned",            color: "#5b21b6", bg: "#f5f3ff" },
  IN_PROGRESS:              { label: "In Progress",         color: "#164e63", bg: "#ecfeff" },
  RESOLVED:                 { label: "Resolved",            color: "#065f46", bg: "#ecfdf5" },
  CLOSED:                   { label: "Closed",              color: "#374151", bg: "#f3f4f6" },
  REJECTED_WRONG_DEPARTMENT:{ label: "Rejected",            color: "#991b1b", bg: "#fef2f2" },
};

const STATUS_DESC = {
  SUBMITTED:                 "Your complaint has been received and is awaiting review.",
  ASSIGNED:                  "A field worker has been assigned to your complaint.",
  IN_PROGRESS:               "Work is currently underway on your complaint.",
  RESOLVED:                  "Your complaint has been resolved. Thank you.",
  CLOSED:                    "This complaint has been closed.",
  REJECTED_WRONG_DEPARTMENT: "This complaint was redirected or rejected. See timeline for details.",
};

function StatusSteps({ status }) {
  const currentIndex = STATUS_ORDER.indexOf(status);
  const isRejected = status === "REJECTED_WRONG_DEPARTMENT" || status === "CLOSED";

  return (
    <div style={{ margin: "20px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {STATUS_ORDER.map((s, i) => {
          const done = !isRejected && i <= currentIndex;
          const active = !isRejected && i === currentIndex;
          return (
            <div key={s} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                <div style={{
                  width: 32, height: 32,
                  borderRadius: "50%",
                  background: done ? "#1a56db" : "#e5e7eb",
                  border: active ? "3px solid #0e9f6e" : "3px solid transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: done ? "#fff" : "#9ca3af",
                  fontSize: 13, fontWeight: 700,
                  transition: "all 0.2s",
                }}>
                  {done ? (i === currentIndex && !isRejected ? i + 1 : "✓") : i + 1}
                </div>
                <div style={{
                  fontSize: 10, marginTop: 5, fontWeight: 600,
                  color: done ? "#1a56db" : "#9ca3af",
                  textAlign: "center", letterSpacing: "0.4px", textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}>
                  {STATUS_META[s].label}
                </div>
              </div>
              {i < STATUS_ORDER.length - 1 && (
                <div style={{
                  height: 3, flex: 1, marginBottom: 18,
                  background: (!isRejected && i < currentIndex) ? "#1a56db" : "#e5e7eb",
                  transition: "background 0.2s",
                }} />
              )}
            </div>
          );
        })}
      </div>

      {isRejected && (
        <div style={{
          marginTop: 10, padding: "8px 14px",
          background: "#fee2e2", borderRadius: 4,
          fontSize: 12, color: "#b91c1c", fontWeight: 600,
          border: "1px solid #fecaca",
        }}>
          {STATUS_META[status]?.label || status}
        </div>
      )}
    </div>
  );
}

function Timeline({ events }) {
  if (!events || events.length === 0) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.7px", color: "#6b7280", marginBottom: 14,
      }}>
        Complaint Timeline
      </div>
      <div style={{ position: "relative", paddingLeft: 24 }}>
        <div style={{
          position: "absolute", left: 7, top: 0, bottom: 0,
          width: 2, background: "#e5e7eb",
        }} />
        {events.map((e, i) => (
          <div key={i} style={{ position: "relative", marginBottom: 20 }}>
            <div style={{
              position: "absolute", left: -21, top: 2,
              width: 14, height: 14, borderRadius: "50%",
              background: "#1a56db", border: "2px solid #0e9f6e",
            }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0d3b2e" }}>
              {e.event}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", margin: "2px 0" }}>
              {e.description}
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              {new Date(e.timestamp).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrackComplaint() {
  const [complaintId, setComplaintId] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const trackComplaint = async () => {
    if (!complaintId.trim()) return;
    try {
      setError("");
      setResult(null);
      setLoading(true);
      const res = await api.get(`/citizen-complaints/track/${complaintId.trim()}`);
      setResult(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || "Complaint not found. Please check your ID.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") trackComplaint();
  };

  const copyId = () => {
    navigator.clipboard.writeText(result.complaint.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const c = result?.complaint;
  const meta = c ? (STATUS_META[c.status] || STATUS_META.SUBMITTED) : null;

  return (
    <div className="container">
      <div className="page-heading">
        <h2>Track Your Complaint</h2>
        <p>Enter your complaint ID to view its current status and history.</p>
      </div>

      {/* Search */}
      <div className="card">
        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="text"
            placeholder="Paste your complaint ID here"
            value={complaintId}
            onChange={(e) => setComplaintId(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ flex: 1 }}
          />
          <button
            onClick={trackComplaint}
            disabled={loading}
            style={{
              background: "#1a56db", color: "#fff",
              border: "2px solid #1a56db", borderRadius: 8,
              padding: "10px 22px", fontWeight: 700,
              fontSize: 14, cursor: "pointer", whiteSpace: "nowrap",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Searching..." : "Track"}
          </button>
        </div>
        {error && <div className="alert alert-error" style={{ marginTop: 14 }}>{error}</div>}
      </div>

      {/* Result */}
      {result && c && (
        <div className="card">
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <h3 style={{ margin: 0 }}>{c.title}</h3>
            <span style={{
              background: meta.bg, color: meta.color,
              padding: "4px 12px", borderRadius: 3,
              fontSize: 11, fontWeight: 700,
              letterSpacing: "0.6px", textTransform: "uppercase",
              whiteSpace: "nowrap", marginLeft: 12,
            }}>
              {meta.label}
            </span>
          </div>

          {/* Status description */}
          <div style={{
            background: "#f8faf9", border: "1px solid #dde3ea",
            borderLeft: `4px solid ${meta.color}`,
            borderRadius: 4, padding: "10px 14px",
            fontSize: 13, color: "#374151", marginBottom: 16,
          }}>
            {STATUS_DESC[c.status]}
          </div>

          {/* Phase 2: Status step bar */}
          <StatusSteps status={c.status} />

          {/* Details */}
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
            {[
              ["Complaint ID", (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 12 }}>{c.id}</span>
                  <button
                    onClick={copyId}
                    style={{
                      background: copied ? "#dcfce7" : "#f1f5f9",
                      border: "1px solid #dde3ea", color: copied ? "#15803d" : "#374151",
                      padding: "2px 10px", borderRadius: 3,
                      fontSize: 11, cursor: "pointer", fontWeight: 600,
                    }}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </span>
              )],
              ["Department", c.department_name],
              ["Type", c.complaint_type],
              ["Description", c.description],
              ["Submitted", new Date(c.submitted_at).toLocaleString()],
              ...(c.resolved_at ? [["Resolved", new Date(c.resolved_at).toLocaleString()]] : []),
              ...(c.rejection_reason ? [["Rejection Reason", c.rejection_reason]] : []),
            ].map(([label, value]) => (
              <div key={label} className="result-row">
                <strong>{label}</strong>
                <span>{value}</span>
              </div>
            ))}
          </div>

          {/* Phase 3: Timeline */}
          {result.timeline && result.timeline.length > 0 && (
            <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 8 }}>
              <Timeline events={result.timeline} />
            </div>
          )}

          {/* Attachments */}
          <div className="attachments-section">
            <div className="attachments-title">Attachments</div>
            {result.attachments.length === 0 ? (
              <p className="empty-text">No attachments uploaded.</p>
            ) : (
              result.attachments.map((a) => (
                <div key={a.id}>
                  <a className="attachment-link" href={a.file_url} target="_blank" rel="noreferrer">
                    View Attachment
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
