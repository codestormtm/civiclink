import { useEffect, useState } from "react";
import api from "../api/api";
import StatusBadge from "../components/StatusBadge";

export default function WorkerDashboard({ openTask }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const name = localStorage.getItem("name") || "Worker";

  const logout = () => {
    localStorage.clear();
    window.location.reload();
  };

  useEffect(() => {
    api.get("/worker/assignments")
      .then((res) => setTasks(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pending   = tasks.filter((t) => t.complaint_status === "ASSIGNED").length;
  const inProgress = tasks.filter((t) => t.complaint_status === "IN_PROGRESS").length;
  const resolved  = tasks.filter((t) => t.complaint_status === "RESOLVED").length;

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6" }}>
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-title">CivicLink — Worker Dashboard</div>
        <div className="topbar-right">
          <span className="topbar-role">FIELD WORKER</span>
          <span className="topbar-name">{name}</span>
          <button className="topbar-logout" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="container">
        {/* Stats */}
        <div className="stats" style={{ gridTemplateColumns: "repeat(3,1fr)", marginTop: 0 }}>
          <div className="stat-card">
            <div className="stat-number blue">{pending}</div>
            <div className="stat-title">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-number teal">{inProgress}</div>
            <div className="stat-title">In Progress</div>
          </div>
          <div className="stat-card">
            <div className="stat-number green">{resolved}</div>
            <div className="stat-title">Resolved</div>
          </div>
        </div>

        <p className="section-title">My Assigned Tasks</p>

        {loading && (
          <p style={{ color: "#9ca3af", fontSize: 14, padding: "24px 0" }}>Loading tasks...</p>
        )}

        {!loading && tasks.length === 0 && (
          <p className="empty">No tasks assigned yet.</p>
        )}

        {!loading && tasks.map((task) => (
          <div className="card" key={task.id} style={{ cursor: "default" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ marginBottom: 8 }}>{task.title}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
                  {[
                    ["Department", task.department_name],
                    ["Type",       task.complaint_type],
                    ["Assigned",   task.assigned_at ? new Date(task.assigned_at).toLocaleDateString() : "—"],
                  ].map(([label, value]) => (
                    <p key={label} style={{ fontSize: 13, color: "#4b5563", margin: 0 }}>
                      <strong style={{ color: "#111827" }}>{label}:</strong> {value || "—"}
                    </p>
                  ))}
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <StatusBadge status={task.complaint_status} />
              </div>
            </div>

            <div style={{ marginTop: 14, borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
              <button className="btn-primary" style={{ width: "auto" }} onClick={() => openTask(task.id)}>
                View Details →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
