import { useCallback, useEffect, useState } from "react";
import api from "./api/api";
import socket, { connectWorkerSocket, disconnectWorkerSocket, syncSocketAuth } from "./api/socket";
import WorkerToast from "./components/WorkerToast";
import Login from "./pages/Login";
import WorkerDashboard from "./pages/WorkerDashboard";
import WorkerTaskDetail from "./pages/WorkerTaskDetail";
import { clearAuth, getDepartment, getName, getRole, getToken } from "./utils/auth";
import { applyLanguage, getStoredLanguage, setStoredLanguage } from "./utils/language";

function buildStoredUser() {
  return {
    name: getName(),
    role: getRole(),
    department_name: getDepartment(),
  };
}

function getNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return window.Notification.permission;
}

function resolveTaskId(payload) {
  return payload?.assignment_id || payload?.id || null;
}

export default function App() {
  const [bootState, setBootState] = useState("booting");
  const [user, setUser] = useState(() => buildStoredUser());
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [language, setLanguage] = useState(() => getStoredLanguage());
  const [notificationPermission, setNotificationPermission] = useState(() => getNotificationPermission());
  const [toast, setToast] = useState(null);

  const pushToast = useCallback(({ title, text, type = "info", taskId = null }) => {
    setToast({
      id: Date.now(),
      title,
      text,
      type,
      taskId,
    });
  }, []);

  const openTask = useCallback((taskId) => {
    setSelectedTaskId(taskId);
    setToast(null);
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrapSession() {
      if (!getToken()) {
        if (active) setBootState("guest");
        return;
      }

      try {
        const res = await api.get("/auth/me");
        const nextUser = res.data?.data;

        if (!nextUser || nextUser.role !== "WORKER") {
          clearAuth();
          if (active) {
            setUser(buildStoredUser());
            setBootState("guest");
          }
          return;
        }

        if (active) {
          setUser(nextUser);
          setBootState("authed");
        }
      } catch {
        clearAuth();
        if (active) {
          setUser(buildStoredUser());
          setBootState("guest");
        }
      }
    }

    bootstrapSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    applyLanguage(language);
  }, [language, bootState, selectedTaskId]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setToast((currentToast) => (currentToast?.id === toast.id ? null : currentToast));
    }, 6000);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    if (bootState !== "authed") {
      disconnectWorkerSocket();
      return undefined;
    }

    connectWorkerSocket();

    const handleTaskAssigned = (payload) => {
      const taskId = resolveTaskId(payload);
      const title = "New task assigned";
      const text = "A new complaint has been assigned to you.";

      pushToast({ title, text, taskId });

      if (
        typeof window !== "undefined"
        && "Notification" in window
        && window.Notification.permission === "granted"
      ) {
        const notification = new window.Notification("CivicLink Worker Portal", {
          body: text,
          tag: taskId ? `worker-task-${taskId}` : "worker-task",
        });

        notification.onclick = () => {
          window.focus();
          if (taskId) {
            openTask(taskId);
          }
          notification.close();
        };
      }
    };

    const handleStatusUpdated = (payload) => {
      pushToast({
        title: "Task updated",
        text: "Your latest task update was saved.",
        type: "success",
        taskId: resolveTaskId(payload),
      });
    };

    socket.on("task_assigned", handleTaskAssigned);
    socket.on("status_updated", handleStatusUpdated);

    return () => {
      socket.off("task_assigned", handleTaskAssigned);
      socket.off("status_updated", handleStatusUpdated);
    };
  }, [bootState, openTask, pushToast]);

  const handleLoggedIn = () => {
    setUser(buildStoredUser());
    setBootState("authed");
    syncSocketAuth();
  };

  const handleLogout = () => {
    disconnectWorkerSocket();
    clearAuth();
    setSelectedTaskId(null);
    setUser(buildStoredUser());
    setBootState("guest");
  };

  const handleLanguageChange = useCallback((nextLanguage) => {
    setStoredLanguage(nextLanguage);
    setLanguage(nextLanguage);
  }, []);

  const handleEnableNotifications = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      pushToast({
        title: "Alerts unavailable",
        text: "This browser does not support notifications.",
      });
      return;
    }

    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      pushToast({
        title: "Alerts enabled",
        text: "You will now see browser alerts for new tasks.",
        type: "success",
      });
      return;
    }

    if (permission === "denied") {
      pushToast({
        title: "Alerts blocked",
        text: "Browser alerts are blocked. You can still use in-app notifications.",
      });
      return;
    }

    pushToast({
      title: "Alerts not enabled",
      text: "You can enable browser alerts later from the header button.",
    });
  }, [pushToast]);

  if (bootState === "booting") {
    return (
      <div className="worker-auth-shell">
        <div className="worker-auth-card">
          <div className="worker-brand worker-brand-auth">
            <div className="worker-brand-icon">C</div>
            <div className="worker-brand-copy notranslate" translate="no">
              <div className="worker-brand-name">CivicLink</div>
              <div className="worker-brand-sub">Field Operations Portal</div>
            </div>
          </div>
          <div className="worker-auth-kicker">Checking session</div>
          <h1>Restoring your worker workspace...</h1>
        </div>
        <WorkerToast toast={toast} onDismiss={() => setToast(null)} onOpen={openTask} />
      </div>
    );
  }

  if (bootState !== "authed") {
    return (
      <>
        <Login
          onLoggedIn={handleLoggedIn}
          language={language}
          onLanguageChange={handleLanguageChange}
        />
        <WorkerToast toast={toast} onDismiss={() => setToast(null)} onOpen={openTask} />
      </>
    );
  }

  if (selectedTaskId) {
    return (
      <>
        <WorkerTaskDetail
          taskId={selectedTaskId}
          user={user}
          goBack={() => setSelectedTaskId(null)}
          onLogout={handleLogout}
          language={language}
          onLanguageChange={handleLanguageChange}
          notificationPermission={notificationPermission}
          onEnableNotifications={handleEnableNotifications}
        />
        <WorkerToast toast={toast} onDismiss={() => setToast(null)} onOpen={openTask} />
      </>
    );
  }

  return (
    <>
      <WorkerDashboard
        user={user}
        openTask={openTask}
        onLogout={handleLogout}
        language={language}
        onLanguageChange={handleLanguageChange}
        notificationPermission={notificationPermission}
        onEnableNotifications={handleEnableNotifications}
      />
      <WorkerToast toast={toast} onDismiss={() => setToast(null)} onOpen={openTask} />
    </>
  );
}
