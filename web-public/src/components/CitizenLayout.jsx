import { useState } from "react";
import { clearCitizenSession, getName } from "../utils/auth";
import { getActiveCitizenTab, setActiveCitizenTab } from "../utils/portalState";

export default function CitizenLayout({ children }) {
  const [menu, setMenuState] = useState(() => getActiveCitizenTab());
  const [activeLang, setActiveLang] = useState("en");
  const [loggingOut, setLoggingOut] = useState(false);

  const name = getName();

  const setMenu = (nextMenu) => {
    setMenuState(nextMenu);
    setActiveCitizenTab(nextMenu);
  };

  const logout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    await clearCitizenSession();
    window.location.reload();
  };

  const changeLanguage = (lang) => {
    setActiveLang(lang);
    if (typeof window.changeLanguage === "function") {
      window.changeLanguage(lang);
    }
  };

  const navItems = [
    { key: "submit", label: "Submit Complaint" },
    { key: "guide", label: "AI Assistant" },
    { key: "track", label: "Track Complaint" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #fff4d6 0%, var(--sl-surface) 100%)" }}>
      <div className="navbar">
        <div className="navbar-brand">
          <div className="navbar-logo">C</div>
          <div>
            <div className="navbar-name">CivicLink</div>
            <div className="navbar-sub">Citizen Portal</div>
          </div>
        </div>

        <div className="nav-tabs">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-tab ${menu === item.key ? "active" : ""}`}
              onClick={() => setMenu(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="navbar-right">
          <div className="lang-switcher">
            {["en", "ta", "si"].map((lang) => (
              <button
                key={lang}
                className={`lang-btn ${activeLang === lang ? "active" : ""}`}
                onClick={() => changeLanguage(lang)}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>

          <span className="nav-user">{name}</span>
          <button className="nav-logout" onClick={logout} disabled={loggingOut}>
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>

      <div>{children({ menu, setMenu })}</div>
    </div>
  );
}
