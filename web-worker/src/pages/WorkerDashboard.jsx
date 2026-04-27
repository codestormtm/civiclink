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
import { useWorkerI18n } from "../i18n";
import StatusBadge from "../components/StatusBadge";
import WorkerHeader from "../components/WorkerHeader";
import OfflineSyncStatus from "../components/OfflineSyncStatus";

function countByStatus(tasks, status) {
  return tasks.filter((task) => task.complaint_status === status).length;
}

const TAB_CONFIG = [
  { key: "ASSIGNED", labelKey: "tab.assigned", icon: ClipboardList },
  { key: "IN_PROGRESS", labelKey: "tab.inProgress", icon: Clock3 },
  { key: "RESOLVED", labelKey: "tab.resolved", icon: CircleCheckBig },
];

export default function WorkerDashboard({
  user,
  openTask,
  onLogout,
  onOpenSettings,
  notificationPermission,
  onEnableNotifications,
  syncState,
  onFlushQueue,
}) {
  const { t, formatDateTime } = useWorkerI18n();
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

    void fetchTasks();
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
        notificationPermission={notificationPermission}
        onEnableNotifications={onEnableNotifications}
        onOpenSettings={onOpenSettings}
        onLogout={onLogout}
      />

      <main className="worker-wrap">
        <OfflineSyncStatus syncState={syncState} onFlushQueue={onFlushQueue} />

        <section className="worker-hero-card">
          <div className="worker-hero-copy">
            <div className="worker-kicker">{t("dashboard.kicker")}</div>
            <h1 className="worker-title">{t("dashboard.title")}</h1>
            <p className="worker-subtitle">
              {user.department_name
                ? t("dashboard.departmentNamed", { department: user.department_name })
                : t("dashboard.departmentFallback")}
            </p>
          </div>
          <div className="worker-hero-meta">
            <div className="worker-hero-chips">
              <span className="worker-count-pill">{t("dashboard.count.assigned", { count: pending })}</span>
              <span className="worker-count-pill">{t("dashboard.count.progress", { count: inProgress })}</span>
              <span className="worker-count-pill">{t("dashboard.count.resolved", { count: resolved })}</span>
            </div>
            <p className="worker-hero-note">{t("dashboard.note")}</p>
          </div>
        </section>

        <section className="worker-card worker-stack-lg">
          <div className="worker-tab-list" role="tablist" aria-label={t("dashboard.tabs")}>
            {TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              const count = countByStatus(tasks, tab.key);
              const isActive = activeTab === tab.key;
              const label = t(tab.labelKey);

              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`worker-tab-btn ${isActive ? "is-active" : ""}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <span className="worker-tab-copy">
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
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
                <span>
                  {t("dashboard.sectionTitle", {
                    label: t(TAB_CONFIG.find((tab) => tab.key === activeTab)?.labelKey || "tab.assigned"),
                  })}
                </span>
              </div>
              <p className="worker-section-copy">{t("dashboard.sectionCopy")}</p>
            </div>
            <span className="worker-count-pill">{t("dashboard.tasksCount", { count: visibleTasks.length })}</span>
          </div>

          {loading ? <p className="worker-empty">{t("dashboard.loading")}</p> : null}
          {!loading && tasks.length === 0 ? <p className="worker-empty">{t("dashboard.empty")}</p> : null}
          {!loading && tasks.length > 0 && visibleTasks.length === 0 ? (
            <p className="worker-empty">{t("dashboard.emptyTab")}</p>
          ) : null}

          {!loading && visibleTasks.length > 0 ? (
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

                  <div className="worker-task-signal-row">
                    <span className="worker-priority-chip">
                      {t("dashboard.priority")}: {task.priority_level || t("dashboard.priorityFallback")}
                    </span>
                    <span className="worker-evidence-chip">{t("dashboard.evidenceNeeded")}</span>
                  </div>

                  <div className="worker-meta-grid">
                    <div>
                      <span className="worker-meta-label">{t("dashboard.meta.department")}</span>
                      <span>{task.department_name || t("dashboard.meta.unassigned")}</span>
                    </div>
                    <div>
                      <span className="worker-meta-label">{t("dashboard.meta.issueType")}</span>
                      <span>{task.complaint_type || t("dashboard.meta.notSpecified")}</span>
                    </div>
                    <div>
                      <span className="worker-meta-label">{t("dashboard.meta.assigned")}</span>
                      <span>{task.assigned_at ? formatDateTime(task.assigned_at) : t("status.unknown")}</span>
                    </div>
                    <div>
                      <span className="worker-meta-label">{t("dashboard.meta.location")}</span>
                      <span>{task.address_text || t("dashboard.meta.locationMissing")}</span>
                    </div>
                  </div>

                  <div className="worker-task-footer">
                    <button
                      type="button"
                      className="worker-primary-btn worker-btn-with-icon"
                      onClick={() => openTask(task.id)}
                    >
                      <FolderOpen size={18} aria-hidden="true" />
                      <span>{t("dashboard.openTask")}</span>
                    </button>

                    {task.address_text ? (
                      <div className="worker-inline-tip">
                        <MapPinned size={16} aria-hidden="true" />
                        <span>{task.address_text}</span>
                      </div>
                    ) : null}
                    <div className="worker-inline-tip">
                      <CircleCheckBig size={16} aria-hidden="true" />
                      <span>{t("dashboard.evidenceCopy")}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
