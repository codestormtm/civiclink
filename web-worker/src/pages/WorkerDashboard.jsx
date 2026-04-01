import { useEffect, useState } from "react";
import api from "../api/api";
import socket from "../api/socket";
import StatusBadge from "../components/StatusBadge";

function countByStatus(tasks, status) {
  return tasks.filter((task) => task.complaint_status === status).length;
}

export default function WorkerDashboard({ user, openTask, onLogout }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetchTasks() {
      try {
        const res = await api.get("/worker/assignments");
        if (active) {
          setTasks(res.data?.data || []);
        }
      } catch {
        if (active) {
          setTasks([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchTasks();
    socket.on("task_assigned", fetchTasks);
    socket.on("status_updated", fetchTasks);

    return () => {
      active = false;
      socket.off("task_assigned", fetchTasks);
      socket.off("status_updated", fetchTasks);
    };
  }, []);

  const pending = countByStatus(tasks, "ASSIGNED");
  const inProgress = countByStatus(tasks, "IN_PROGRESS");
  const resolved = countByStatus(tasks, "RESOLVED");

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
            <div className="worker-identity">
              <span className="worker-role-pill">WORKER</span>
              <span>{user.name || "Worker"}</span>
            </div>
            <button type="button" className="worker-secondary-btn" onClick={onLogout}>
              Log Out
            </button>
          </div>
        </div>
      </header>

      <main className="worker-wrap">
        <section className="worker-hero-card">
          <div className="worker-hero-copy">
            <div className="worker-kicker">Field Operations Board</div>
            <h1 className="worker-title">Assigned complaints</h1>
            <p className="worker-subtitle">
              {user.department_name ? `${user.department_name} operations` : "Your department operations"}
            </p>
          </div>
          <div className="worker-hero-meta">
            <span className="worker-count-pill">{tasks.length} live tasks</span>
            <p className="worker-hero-note">Track assigned work, update status quickly, and attach field evidence without switching portals.</p>
          </div>
        </section>

        <section className="worker-stats">
          <article className="worker-stat-card">
            <span className="worker-stat-label">Pending</span>
            <strong>{pending}</strong>
          </article>
          <article className="worker-stat-card">
            <span className="worker-stat-label">In Progress</span>
            <strong>{inProgress}</strong>
          </article>
          <article className="worker-stat-card">
            <span className="worker-stat-label">Resolved</span>
            <strong>{resolved}</strong>
          </article>
        </section>

        <section className="worker-card worker-stack-lg">
          <div className="worker-section-header">
            <div>
              <div className="worker-section-heading">Assigned Tasks</div>
              <p className="worker-section-copy">Open a task to update progress, add notes, and upload field evidence.</p>
            </div>
            <span className="worker-count-pill">{tasks.length} tasks</span>
          </div>

          {loading && <p className="worker-empty">Loading assigned complaints...</p>}
          {!loading && tasks.length === 0 && <p className="worker-empty">No tasks assigned yet.</p>}

          {!loading && tasks.length > 0 && (
            <div className="worker-task-list">
              {tasks.map((task) => (
                <article className="worker-task-card" key={task.id}>
                  <div className="worker-task-top">
                    <div className="worker-stack">
                      <h2>{task.title}</h2>
                      <p>{task.description}</p>
                    </div>
                    <StatusBadge status={task.complaint_status} />
                  </div>

                  <div className="worker-meta-grid">
                    <div>
                      <span className="worker-meta-label">Department</span>
                      <span>{task.department_name || "Unassigned"}</span>
                    </div>
                    <div>
                      <span className="worker-meta-label">Issue Type</span>
                      <span>{task.complaint_type || "Not specified"}</span>
                    </div>
                    <div>
                      <span className="worker-meta-label">Assigned</span>
                      <span>{task.assigned_at ? new Date(task.assigned_at).toLocaleString() : "Unknown"}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="worker-primary-btn"
                    onClick={() => openTask(task.id)}
                  >
                    Open Task
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
