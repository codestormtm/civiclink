import { useEffect, useState } from "react";
import Header from "./Header";

export default function Layout({ children }) {
  const [menu, setMenu] = useState("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = [
    { key: "dashboard", label: "Overview" },
    { key: "queue", label: "Issue Queue" },
    { key: "map", label: "Active Map" },
    { key: "sla", label: "SLA Alerts" },
    { key: "workers", label: "Staff" },
    { key: "reports", label: "Reports" },
  ];

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  const handleMenuSelect = (nextMenu) => {
    setMenu(nextMenu);
    setDrawerOpen(false);
  };

  return (
    <div className="layout">
      <div className={`sidebar-backdrop ${drawerOpen ? "is-open" : ""}`} onClick={() => setDrawerOpen(false)} />

      <div className={`sidebar ${drawerOpen ? "is-open" : ""}`} onClick={(event) => event.stopPropagation()}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">C</div>
          <span>
            CivicLink
            <small>Department Admin</small>
          </span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              type="button"
              key={item.key}
              className={`sidebar-item ${menu === item.key ? "active" : ""}`}
              onClick={() => handleMenuSelect(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="layout-content">
        <Header onToggleMenu={() => setDrawerOpen((value) => !value)} isMenuOpen={drawerOpen} />
        {children(menu)}
      </div>
    </div>
  );
}
