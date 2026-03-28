import { useState } from "react";
import Header from "./Header";

export default function Layout({ children }) {
  const [menu, setMenu] = useState("dashboard");

  const navItems = [
    { key: "dashboard", label: "Dashboard" },
    { key: "workers", label: "Workers" },
    { key: "reports", label: "Reports" },
  ];

  return (
    <div className="layout">
      <div className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">C</div>
          CivicLink
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <div
              key={item.key}
              className={`sidebar-item ${menu === item.key ? "active" : ""}`}
              onClick={() => setMenu(item.key)}
            >
              {item.label}
            </div>
          ))}
        </nav>
      </div>

      <div className="layout-content">
        <Header />
        {children(menu)}
      </div>
    </div>
  );
}
