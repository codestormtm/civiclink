import {
  CircleCheckBig,
  ClipboardList,
  Clock3,
  FolderOpen,
  MapPinned,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import api from "../api/api";
import socket from "../api/socket";
import StatusBadge from "../components/StatusBadge";
import WorkerHeader from "../components/WorkerHeader";

function countByStatus(tasks, status) {
  return tasks.filter((task) => task.complaint_status === status).length;
}

const TAB_CONFIG = [
  { key: "ASSIGNED", label: "Assigned", icon: ClipboardList },
  { key: "IN_PROGRESS", label: "In Progress", icon: Clock3 },
  { key: "RESOLVED", label: "Resolved", icon: CircleCheckBig },
];

export default function WorkerDashboard({
  user,
  openTask,
  onLogout,
  language,
  onLanguageChange,
  notificationPermission,
  onEnableNotifications,
}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ASSIGNED");

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
  const visibleTasks = tasks.filter((task) => task.complaint_status === activeTab);

  return (
    <div className="worker-shell">
      <WorkerHeader
        user={user}
        language={language}
        onLanguageChange={onLanguageChange}
        notificationPermission={notificationPermission}
        onEnableNotifications={onEnableNotifications}
        onLogout={onLogout}
      />

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
            <div className="worker-hero-chips">
              <span className="worker-count-pill">{pending} assigned</span>
              <span className="worker-count-pill">{inProgress} in progress</span>
              <span className="worker-count-pill">{resolved} resolved</span>
            </div>
            <p className="worker-hero-note">Track assigned work, update status quickly, and attach field evidence without switching portals.</p>
          </div>
        </section>

        <section className="worker-card worker-stack-lg">
          <div className="worker-tab-list" role="tablist" aria-label="Task status tabs">
            {TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              const count = countByStatus(tasks, tab.key);
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`worker-tab-btn ${isActive ? "is-active" : ""}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <span className="worker-tab-copy">
                    <Icon size={18} aria-hidden="true" />
                    <span>{tab.label}</span>
                  </span>
                  <span className="worker-tab-count">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="worker-section-header">
            <div>
              <div className="worker-section-title">
                <Wrench size={18} aria-hidden="true" />
                <span>{TAB_CONFIG.find((tab) => tab.key === activeTab)?.label} Tasks</span>
              </div>
              <p className="worker-section-copy">Open a task to update progress, add notes, and upload field evidence.</p>
            </div>
            <span className="worker-count-pill">{visibleTasks.length} tasks</span>
          </div>

          {loading && <p className="worker-empty">Loading tasks...</p>}
          {!loading && tasks.length === 0 && <p className="worker-empty">No tasks assigned yet.</p>}

          {!loading && tasks.length > 0 && visibleTasks.length === 0 && (
            <p className="worker-empty">No tasks in this tab right now.</p>
          )}

          {!loading && visibleTasks.length > 0 && (
            <div className="worker-task-list">
              {visibleTasks.map((task) => (
                <article className="worker-task-card" key={task.id}>
                  <div className="worker-task-top">
                    <div className="worker-stack">
                      <div className="worker-task-title-row">
                        <ClipboardList size={20} aria-hidden="true" />
                        <h2>{task.title}</h2>
                      </div>
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
                    <div>
                      <span className="worker-meta-label">Location</span>
                      <span>{task.address_text || "Location not added"}</span>
                    </div>
                  </div>

                  <div className="worker-task-footer">
                    <button
                      type="button"
                      className="worker-primary-btn worker-btn-with-icon"
                      onClick={() => openTask(task.id)}
                    >
                      <FolderOpen size={18} aria-hidden="true" />
                      <span>Open Task</span>
                    </button>

                    {task.address_text ? (
                      <div className="worker-inline-tip">
                        <MapPinned size={16} aria-hidden="true" />
                        <span>{task.address_text}</span>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
