import { useState } from "react";
import { clearAuth, getName } from "../utils/auth";

export default function CitizenLayout({ children }) {
  const [menu, setMenu] = useState("guide");
  const [activeLang, setActiveLang] = useState("en");

  const name = getName();

  const logout = () => {
    clearAuth();
    window.location.reload();
  };

  const changeLanguage = (lang) => {
    setActiveLang(lang);
    if (typeof window.changeLanguage === "function") {
      window.changeLanguage(lang);
    }
  };

  const navItems = [
    { key: "guide", label: "🤖 AI Assistant" },
    { key: "submit", label: "Submit Complaint" },
    { key: "track", label: "Track Complaint" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #fff4d6 0%, var(--sl-surface) 100%)" }}>
      {/* Navbar */}
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
          {/* Language switcher */}
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
          <button className="nav-logout" onClick={logout}>Logout</button>
        </div>
      </div>

      {/* Page content */}
      <div>{children(menu)}</div>
    </div>
  );
}
