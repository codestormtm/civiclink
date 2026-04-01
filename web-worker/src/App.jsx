import { useEffect, useState } from "react";
import api from "./api/api";
import Login from "./pages/Login";
import WorkerDashboard from "./pages/WorkerDashboard";
import WorkerTaskDetail from "./pages/WorkerTaskDetail";
import { clearAuth, getDepartment, getName, getRole, getToken } from "./utils/auth";

function buildStoredUser() {
  return {
    name: getName(),
    role: getRole(),
    department_name: getDepartment(),
  };
}

export default function App() {
  const [bootState, setBootState] = useState("booting");
  const [user, setUser] = useState(() => buildStoredUser());
  const [selectedTaskId, setSelectedTaskId] = useState(null);

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

  const handleLoggedIn = () => {
    setUser(buildStoredUser());
    setBootState("authed");
  };

  const handleLogout = () => {
    clearAuth();
    setSelectedTaskId(null);
    setUser(buildStoredUser());
    setBootState("guest");
  };

  if (bootState === "booting") {
    return (
      <div className="worker-auth-shell">
        <div className="worker-auth-card">
          <div className="worker-brand worker-brand-auth">
            <div className="worker-brand-icon">C</div>
            <div className="worker-brand-copy">
              <div className="worker-brand-name">CivicLink</div>
              <div className="worker-brand-sub">Field Operations Portal</div>
            </div>
          </div>
          <div className="worker-auth-kicker">Checking session</div>
          <h1>Restoring your worker workspace...</h1>
        </div>
      </div>
    );
  }

  if (bootState !== "authed") {
    return <Login onLoggedIn={handleLoggedIn} />;
  }

  if (selectedTaskId) {
    return (
      <WorkerTaskDetail
        taskId={selectedTaskId}
        user={user}
        goBack={() => setSelectedTaskId(null)}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <WorkerDashboard
      user={user}
      openTask={setSelectedTaskId}
      onLogout={handleLogout}
    />
  );
}
