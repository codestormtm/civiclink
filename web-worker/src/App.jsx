import { useCallback, useEffect, useState } from "react";
import api from "./api/api";
import socket, { connectWorkerSocket, disconnectWorkerSocket, syncSocketAuth } from "./api/socket";
import { WorkerI18nProvider, translate } from "./i18n";
import WorkerToast from "./components/WorkerToast";
import Login from "./pages/Login";
import WorkerDashboard from "./pages/WorkerDashboard";
import WorkerLanguageSetup from "./pages/WorkerLanguageSetup";
import WorkerSettings from "./pages/WorkerSettings";
import WorkerTaskDetail from "./pages/WorkerTaskDetail";
import {
  clearAuth,
  getDepartment,
  getName,
  getPreferredLanguage,
  getRole,
  getToken,
  setAuth,
  setPreferredLanguage,
} from "./utils/auth";
import { applyLanguage, getStoredLanguage, setStoredLanguage } from "./utils/language";
import { postWorkerMobileLogout, postWorkerMobileSession } from "./utils/mobileBridge";
import { flushWorkerQueue, getWorkerQueueSnapshot } from "./utils/offlineQueue";

function buildStoredUser() {
  return {
    name: getName(),
    role: getRole(),
    department_name: getDepartment(),
    preferred_language: getPreferredLanguage() || null,
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

function getInitialTaskIdFromPath() {
  const match = window.location.pathname.match(/^\/task\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function App() {
  const [bootState, setBootState] = useState("booting");
  const [user, setUser] = useState(() => buildStoredUser());
  const [selectedTaskId, setSelectedTaskId] = useState(() => getInitialTaskIdFromPath());
  const [activeView, setActiveView] = useState("dashboard");
  const [language, setLanguage] = useState(() => getPreferredLanguage() || getStoredLanguage());
  const [notificationPermission, setNotificationPermission] = useState(() => getNotificationPermission());
  const [toast, setToast] = useState(null);
  const [syncState, setSyncState] = useState(() => ({
    ...getWorkerQueueSnapshot(),
    syncing: false,
  }));

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

  const applySelectedLanguage = useCallback((nextLanguage) => {
    setStoredLanguage(nextLanguage);
    setLanguage(nextLanguage);
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrapSession() {
      if (!getToken()) {
        if (active) {
          setBootState("guest");
        }
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
          const nextLanguage = nextUser.preferred_language || getPreferredLanguage() || getStoredLanguage();
          if (nextLanguage) {
            setStoredLanguage(nextLanguage);
            setLanguage(nextLanguage);
          }
          postWorkerMobileSession({ preferred_language: nextLanguage });
          setBootState(nextUser.preferred_language ? "authed" : "needs_language");
        }
      } catch {
        clearAuth();
        if (active) {
          setUser(buildStoredUser());
          setBootState("guest");
        }
      }
    }

    void bootstrapSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    applyLanguage(language);
  }, [language]);

  const refreshSyncState = useCallback((extra = {}) => {
    setSyncState({
      ...getWorkerQueueSnapshot(),
      ...extra,
    });
  }, []);

  const flushQueuedWork = useCallback(async () => {
    if (bootState !== "authed") {
      refreshSyncState();
      return;
    }

    refreshSyncState({ syncing: true });
    const snapshot = await flushWorkerQueue();
    setSyncState({ ...snapshot, syncing: false });
  }, [bootState, refreshSyncState]);

  useEffect(() => {
    const handleOnline = () => {
      void flushQueuedWork();
    };
    const handleOffline = () => refreshSyncState();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushQueuedWork, refreshSyncState]);

  useEffect(() => {
    if (bootState === "authed") {
      const timeoutId = window.setTimeout(() => {
        void flushQueuedWork();
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [bootState, flushQueuedWork]);

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
      const title = translate(language, "toast.newTaskTitle");
      const text = translate(language, "toast.newTaskText");

      pushToast({ title, text, taskId });

      if (
        typeof window !== "undefined"
        && "Notification" in window
        && window.Notification.permission === "granted"
      ) {
        const notification = new window.Notification(translate(language, "portal.worker"), {
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
        title: translate(language, "toast.updatedTitle"),
        text: translate(language, "toast.updatedText"),
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
  }, [bootState, language, openTask, pushToast]);

  const handleLoggedIn = (sessionPayload) => {
    const nextUser = {
      name: sessionPayload?.name || getName(),
      role: sessionPayload?.role || getRole(),
      department_name: sessionPayload?.department_name || getDepartment(),
      preferred_language: sessionPayload?.preferred_language || null,
    };

    setUser(nextUser);
    setSelectedTaskId(null);
    setActiveView("dashboard");

    if (sessionPayload?.preferred_language) {
      setPreferredLanguage(sessionPayload.preferred_language);
      applySelectedLanguage(sessionPayload.preferred_language);
      postWorkerMobileSession({ preferred_language: sessionPayload.preferred_language });
      setBootState("authed");
    } else {
      setBootState("needs_language");
    }

    syncSocketAuth();
  };

  const handleLogout = () => {
    postWorkerMobileLogout();
    disconnectWorkerSocket();
    clearAuth();
    setSelectedTaskId(null);
    setActiveView("dashboard");
    setUser(buildStoredUser());
    setBootState("guest");
  };

  const handleSavePreferredLanguage = useCallback(async (nextLanguage) => {
    const res = await api.patch("/auth/preferences", { preferred_language: nextLanguage });
    const updatedUser = res.data?.data;

    setAuth({
      token: getToken(),
      role: updatedUser?.role || user.role,
      name: updatedUser?.name || user.name,
      department_name: updatedUser?.department_name || user.department_name,
      preferred_language: updatedUser?.preferred_language || nextLanguage,
    });

    setPreferredLanguage(updatedUser?.preferred_language || nextLanguage);
    applySelectedLanguage(updatedUser?.preferred_language || nextLanguage);
    setUser((current) => ({
      ...current,
      ...updatedUser,
      preferred_language: updatedUser?.preferred_language || nextLanguage,
    }));
    postWorkerMobileSession({ preferred_language: updatedUser?.preferred_language || nextLanguage });
    setBootState("authed");
    setActiveView("dashboard");
  }, [applySelectedLanguage, user.department_name, user.name, user.role]);

  const handleEnableNotifications = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      pushToast({
        title: translate(language, "notifications.unavailableTitle"),
        text: translate(language, "notifications.unavailableText"),
      });
      return;
    }

    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      pushToast({
        title: translate(language, "notifications.enabledTitle"),
        text: translate(language, "notifications.enabledText"),
        type: "success",
      });
      return;
    }

    if (permission === "denied") {
      pushToast({
        title: translate(language, "notifications.blockedTitle"),
        text: translate(language, "notifications.blockedText"),
      });
      return;
    }

    pushToast({
      title: translate(language, "notifications.notEnabledTitle"),
      text: translate(language, "notifications.notEnabledText"),
    });
  }, [language, pushToast]);

  return (
    <WorkerI18nProvider language={language}>
      {bootState === "booting" ? (
        <div className="worker-auth-shell">
          <div className="worker-auth-card">
            <div className="worker-brand worker-brand-auth">
              <div className="worker-brand-icon">C</div>
              <div className="worker-brand-copy notranslate" translate="no">
                <div className="worker-brand-name">{translate(language, "portal.brand")}</div>
                <div className="worker-brand-sub">{translate(language, "portal.fieldOperations")}</div>
              </div>
            </div>
            <div className="worker-auth-kicker">{translate(language, "boot.kicker")}</div>
            <h1>{translate(language, "boot.title")}</h1>
          </div>
          <WorkerToast toast={toast} onDismiss={() => setToast(null)} onOpen={openTask} />
        </div>
      ) : null}

      {bootState === "guest" ? (
        <>
          <Login onLoggedIn={handleLoggedIn} />
          <WorkerToast toast={toast} onDismiss={() => setToast(null)} onOpen={openTask} />
        </>
      ) : null}

      {bootState === "needs_language" ? (
        <>
          <WorkerLanguageSetup
            language={language}
            onLanguageChange={applySelectedLanguage}
            onContinue={handleSavePreferredLanguage}
          />
          <WorkerToast toast={toast} onDismiss={() => setToast(null)} onOpen={openTask} />
        </>
      ) : null}

      {bootState === "authed" && activeView === "settings" ? (
        <>
          <WorkerSettings
            user={user}
            language={language}
            onLanguageChange={applySelectedLanguage}
            onSave={handleSavePreferredLanguage}
            onBack={() => setActiveView("dashboard")}
            onLogout={handleLogout}
            notificationPermission={notificationPermission}
            onEnableNotifications={handleEnableNotifications}
          />
          <WorkerToast toast={toast} onDismiss={() => setToast(null)} onOpen={openTask} />
        </>
      ) : null}

      {bootState === "authed" && activeView !== "settings" && selectedTaskId ? (
        <>
          <WorkerTaskDetail
            taskId={selectedTaskId}
            user={user}
            goBack={() => setSelectedTaskId(null)}
            onLogout={handleLogout}
            onOpenSettings={() => setActiveView("settings")}
            notificationPermission={notificationPermission}
            onEnableNotifications={handleEnableNotifications}
            syncState={syncState}
            onSyncStateChange={refreshSyncState}
            onFlushQueue={flushQueuedWork}
          />
          <WorkerToast toast={toast} onDismiss={() => setToast(null)} onOpen={openTask} />
        </>
      ) : null}

      {bootState === "authed" && activeView !== "settings" && !selectedTaskId ? (
        <>
          <WorkerDashboard
            user={user}
            openTask={openTask}
            onLogout={handleLogout}
            onOpenSettings={() => setActiveView("settings")}
            notificationPermission={notificationPermission}
            onEnableNotifications={handleEnableNotifications}
            syncState={syncState}
            onFlushQueue={flushQueuedWork}
          />
          <WorkerToast toast={toast} onDismiss={() => setToast(null)} onOpen={openTask} />
        </>
      ) : null}
    </WorkerI18nProvider>
  );
}
