import { useEffect, useState } from "react";
import api from "./api/api";
import { connectAdminSocket, disconnectAdminSocket, syncSocketAuth } from "./api/socket";
import socket from "./api/socket";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Workers from "./pages/Workers";
import DepartmentReports from "./pages/DepartmentReports";
import SystemAdmin from "./pages/SystemAdmin";
import { clearAuth, getRole, getToken } from "./utils/auth";

function getBrowserNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return window.Notification.permission;
}

function App() {
  const [sessionReady, setSessionReady] = useState(false);
  const [role, setRole] = useState("");
  const [notificationPermission, setNotificationPermission] = useState(() => getBrowserNotificationPermission());

  useEffect(() => {
    if (!["SYSTEM_ADMIN", "DEPT_ADMIN"].includes(role)) {
      disconnectAdminSocket();
      return undefined;
    }

    syncSocketAuth();
    connectAdminSocket();

    return () => {
      disconnectAdminSocket();
    };
  }, [role]);

  useEffect(() => {
    if (!["SYSTEM_ADMIN", "DEPT_ADMIN"].includes(role)) {
      return undefined;
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      return undefined;
    }

    if (window.Notification.permission === "default") {
      void window.Notification.requestPermission().then((permission) => {
        setNotificationPermission(permission);
      });
    }

    return undefined;
  }, [role]);

  useEffect(() => {
    if (!["SYSTEM_ADMIN", "DEPT_ADMIN"].includes(role)) {
      return undefined;
    }

    const handleRealtimeNotification = (payload) => {
      if (
        typeof window === "undefined"
        || !("Notification" in window)
        || notificationPermission !== "granted"
      ) {
        return;
      }

      const notification = new window.Notification(payload?.title || "CivicLink", {
        body: payload?.body || "You have a CivicLink update.",
        tag: payload?.channel || "civiclink-admin",
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    };

    socket.on("notification", handleRealtimeNotification);

    return () => {
      socket.off("notification", handleRealtimeNotification);
    };
  }, [notificationPermission, role]);

  useEffect(() => {
    let active = true;

    async function bootstrapSession() {
      const token = getToken();
      const storedRole = getRole();

      if (!token) {
        if (active) {
          setRole("");
          setSessionReady(true);
        }
        return;
      }

      if (storedRole === "WORKER") {
        clearAuth();
        if (active) {
          setRole("");
          setSessionReady(true);
        }
        return;
      }

      try {
        const res = await api.get("/auth/me");
        const nextRole = res.data?.data?.role || "";

        if (!["SYSTEM_ADMIN", "DEPT_ADMIN"].includes(nextRole)) {
          clearAuth();
          if (active) {
            setRole("");
            setSessionReady(true);
          }
          return;
        }

        if (active) {
          setRole(nextRole);
          setSessionReady(true);
        }
      } catch {
        clearAuth();
        if (active) {
          setRole("");
          setSessionReady(true);
        }
      }
    }

    bootstrapSession();

    return () => {
      active = false;
    };
  }, []);

  const handleLoggedIn = (nextLoggedIn) => {
    if (!nextLoggedIn) {
      disconnectAdminSocket();
      clearAuth();
      setRole("");
      setSessionReady(true);
      return;
    }

    syncSocketAuth();
    setRole(getRole() || "");
    setSessionReady(true);
  };

  if (!sessionReady) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">CivicLink</div>
          <p className="login-subtitle">Checking admin session...</p>
        </div>
      </div>
    );
  }

  if (!role) {
    return <Login setLoggedIn={handleLoggedIn} />;
  }

  if (role === "SYSTEM_ADMIN") return <SystemAdmin />;

  if (role === "DEPT_ADMIN") {
    return (
      <Layout>
        {(menu) => {
          if (menu === "workers") return <Workers />;
          if (menu === "reports") return <DepartmentReports />;
          if (menu === "queue") return <Dashboard focus="queue" />;
          if (menu === "map") return <Dashboard focus="map" />;
          if (menu === "sla") return <Dashboard focus="sla" />;
          return <Dashboard focus="overview" />;
        }}
      </Layout>
    );
  }

  clearAuth();
  return <Login setLoggedIn={handleLoggedIn} />;
}

export default App;
