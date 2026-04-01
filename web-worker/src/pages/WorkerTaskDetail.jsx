import { useCallback, useEffect, useState } from "react";
import api from "../api/api";
import ComplaintTimeline from "../components/ComplaintTimeline";
import StatusBadge from "../components/StatusBadge";

function buildMapsUrl(latitude, longitude) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export default function WorkerTaskDetail({ taskId, user, goBack, onLogout }) {
  const [data, setData] = useState(null);
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });

  const fetchTask = useCallback(async () => {
    try {
      const res = await api.get(`/worker/assignments/${taskId}`);
      setData(res.data?.data || null);
    } catch (err) {
      setMessage({
        type: "error",
        text: err?.response?.data?.error || "Failed to load task details.",
      });
    }
  }, [taskId]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await api.get(`/worker/assignments/${taskId}`);
        if (active) {
          setData(res.data?.data || null);
        }
      } catch (err) {
        if (active) {
          setMessage({
            type: "error",
            text: err?.response?.data?.error || "Failed to load task details.",
          });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [taskId]);

  const updateStatus = async (status) => {
    try {
      await api.patch(`/worker/assignments/${taskId}/status`, { status, note });
      setMessage({
        type: "success",
        text: status === "IN_PROGRESS" ? "Task started successfully." : "Task marked as resolved.",
      });
      setNote("");
      fetchTask();
    } catch (err) {
      setMessage({
        type: "error",
        text: err?.response?.data?.error || "Failed to update status.",
      });
    }
  };

  const uploadEvidence = async () => {
    if (!file) {
      setMessage({ type: "error", text: "Choose a file before uploading evidence." });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post(`/worker/assignments/${taskId}/attachments`, formData);
      setFile(null);
      setMessage({ type: "success", text: "Evidence uploaded successfully." });
      fetchTask();
    } catch (err) {
      setMessage({
        type: "error",
        text: err?.response?.data?.error || "Failed to upload evidence.",
      });
    }
  };

  if (!data) {
    return (
      <div className="worker-shell">
        <header className="worker-header">
          <div className="worker-header-inner">
            <div className="worker-header-main">
              <div className="worker-brand">
                <div className="worker-brand-icon">C</div>
                <div className="worker-brand-copy">
                  <div className="worker-brand-name">CivicLink</div>
                  <div className="worker-brand-sub">Worker Portal</div>
                </div>
              </div>
            </div>
            <div className="worker-header-actions">
              <button type="button" className="worker-secondary-btn" onClick={goBack}>
                Back
              </button>
              <button type="button" className="worker-secondary-btn" onClick={onLogout}>
                Log Out
              </button>
            </div>
          </div>
        </header>
        <main className="worker-wrap">
          <section className="worker-hero-card worker-hero-card-compact">
            <div className="worker-hero-copy">
              <div className="worker-kicker">Field Operations</div>
              <h1 className="worker-title">Task detail</h1>
            </div>
          </section>

          <section className="worker-card">
            {message.text ? (
              <div className={`worker-alert worker-alert-${message.type}`}>{message.text}</div>
            ) : (
              <p className="worker-empty">Loading task details...</p>
            )}
          </section>
        </main>
      </div>
    );
  }

  const { assignment, attachments, history } = data;
  const latitude = assignment.latitude != null ? Number(assignment.latitude) : null;
  const longitude = assignment.longitude != null ? Number(assignment.longitude) : null;
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  const canStart = assignment.complaint_status === "ASSIGNED";
  const canResolve = assignment.complaint_status === "IN_PROGRESS";

  return (
    <div className="worker-shell">
      <header className="worker-header">
        <div className="worker-header-inner">
          <div className="worker-header-main">
            <div className="worker-brand">
              <div className="worker-brand-icon">C</div>
              <div className="worker-brand-copy">
                <div className="worker-brand-name">CivicLink</div>
                <div className="worker-brand-sub">Worker Portal</div>
              </div>
            </div>
          </div>
          <div className="worker-header-actions">
            <StatusBadge status={assignment.complaint_status} />
            <button type="button" className="worker-secondary-btn" onClick={goBack}>
              Back
            </button>
            <button type="button" className="worker-secondary-btn" onClick={onLogout}>
              Log Out
            </button>
          </div>
        </div>
      </header>

      <main className="worker-wrap worker-stack-lg">
        <section className="worker-hero-card worker-hero-card-detail">
          <div className="worker-hero-copy">
            <div className="worker-kicker">Assigned task</div>
            <h1 className="worker-title">{assignment.title}</h1>
            <p className="worker-subtitle">{user.name || "Worker"}</p>
          </div>
          <div className="worker-hero-meta">
            <StatusBadge status={assignment.complaint_status} />
            <p className="worker-hero-note">Update progress in the field, keep the department informed, and close the complaint with evidence.</p>
          </div>
        </section>

        {message.text && (
          <div className={`worker-alert worker-alert-${message.type}`}>{message.text}</div>
        )}

        <section className="worker-card worker-stack-lg">
          <div className="worker-section-heading">Complaint Details</div>

          <div className="worker-detail-grid">
            <div>
              <span className="worker-meta-label">Department</span>
              <span>{assignment.department_name || "Unknown"}</span>
            </div>
            <div>
              <span className="worker-meta-label">Issue Type</span>
              <span>{assignment.complaint_type || "Unknown"}</span>
            </div>
            <div>
              <span className="worker-meta-label">Assigned</span>
              <span>{assignment.assigned_at ? new Date(assignment.assigned_at).toLocaleString() : "Unknown"}</span>
            </div>
            <div>
              <span className="worker-meta-label">Description</span>
              <span>{assignment.description || "No description provided."}</span>
            </div>
          </div>

          {(assignment.address_text || hasCoordinates) && (
            <div className="worker-location-card">
              <div className="worker-section-heading">Location</div>
              <p>
                {assignment.address_text
                  || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}
              </p>
              {hasCoordinates && (
                <a
                  className="worker-link-chip"
                  href={buildMapsUrl(latitude, longitude)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Navigation
                </a>
              )}
            </div>
          )}
        </section>

        <section className="worker-card worker-stack-lg">
          <div className="worker-section-heading">Update Work Status</div>
          <textarea
            className="worker-textarea"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            placeholder="Add a field note or progress update..."
          />

          <div className="worker-actions">
            <button
              type="button"
              className="worker-primary-btn"
              onClick={() => updateStatus("IN_PROGRESS")}
              disabled={!canStart}
            >
              Start Work
            </button>
            <button
              type="button"
              className="worker-primary-btn worker-success-btn"
              onClick={() => updateStatus("RESOLVED")}
              disabled={!canResolve}
            >
              Mark Resolved
            </button>
          </div>
        </section>

        <section className="worker-card worker-stack-lg">
          <div className="worker-section-heading">Upload Evidence</div>
          <input
            className="worker-file-input"
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          <button type="button" className="worker-primary-btn" onClick={uploadEvidence}>
            Upload Evidence
          </button>
        </section>

        <section className="worker-card worker-stack-lg">
          <div className="worker-section-heading">Attachments</div>
          {attachments?.length ? (
            <div className="worker-stack">
              {attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  className="worker-link-chip"
                  href={attachment.file_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  View uploaded attachment
                </a>
              ))}
            </div>
          ) : (
            <p className="worker-empty worker-empty-inline">No attachments uploaded yet.</p>
          )}
        </section>

        <section className="worker-card">
          <ComplaintTimeline history={history} />
        </section>
      </main>
    </div>
  );
}
