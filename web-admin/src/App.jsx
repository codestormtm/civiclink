import { useState } from "react";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Workers from "./pages/Workers";
import DepartmentReports from "./pages/DepartmentReports";
import SystemAdmin from "./pages/SystemAdmin";
import WorkerDashboard from "./pages/WorkerDashboard";
import WorkerTaskDetail from "./pages/WorkerTaskDetail";
import { clearAuth, getRole, isAuthenticated } from "./utils/auth";

function App() {
  const [loggedIn, setLoggedIn] = useState(isAuthenticated());
  const [selectedWorkerTaskId, setSelectedWorkerTaskId] = useState(null);

  const role = getRole();
  const normalizedRole = role === "FIELD_WORKER" ? "WORKER" : role;

  if (!loggedIn) {
    return <Login setLoggedIn={setLoggedIn} />;
  }

  if (normalizedRole === "SYSTEM_ADMIN") return <SystemAdmin />;

  if (normalizedRole === "DEPT_ADMIN") {
    return (
      <Layout>
        {(menu) => {
          if (menu === "workers") return <Workers />;
          if (menu === "reports") return <DepartmentReports />;
          return <Dashboard />;
        }}
      </Layout>
    );
  }

  if (normalizedRole === "WORKER") {
    if (selectedWorkerTaskId) {
      return (
        <WorkerTaskDetail
          taskId={selectedWorkerTaskId}
          goBack={() => setSelectedWorkerTaskId(null)}
        />
      );
    }

    return <WorkerDashboard openTask={(id) => setSelectedWorkerTaskId(id)} />;
  }

  clearAuth();
  return <Login setLoggedIn={setLoggedIn} />;
}

export default App;
