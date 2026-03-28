import { useState } from "react";
import Login from "./pages/Login";
import CitizenComplaintForm from "./pages/CitizenComplaintForm";
import TrackComplaint from "./pages/TrackComplaint";
import GuidedReportPage from "./pages/GuidedReportPage";
import CitizenLayout from "./components/CitizenLayout";
import PublicDashboard from "./pages/PublicDashboard";
import { isCitizenAuthenticated, getRole, clearAuth } from "./utils/auth";

function App() {
  const [loggedIn, setLoggedIn] = useState(isCitizenAuthenticated());
  const isPublicDashboardRoute = window.location.pathname === "/public";

  if (isPublicDashboardRoute) {
    return <PublicDashboard />;
  }

  if (!loggedIn) {
    return <Login setLoggedIn={setLoggedIn} />;
  }

  if (getRole() !== "CITIZEN") {
    clearAuth();
    return <Login setLoggedIn={setLoggedIn} />;
  }

  return (
    <CitizenLayout>
      {(menu) => {
        if (menu === "track") return <TrackComplaint />;
        if (menu === "submit") return <CitizenComplaintForm />;
        return <GuidedReportPage />;
      }}
    </CitizenLayout>
  );
}

export default App;
