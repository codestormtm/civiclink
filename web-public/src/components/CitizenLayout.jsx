import { useEffect, useState } from "react";
import { clearCitizenSession } from "../utils/auth";
import { postCitizenMobileLogout } from "../utils/mobileBridge";
import { setActiveCitizenTab } from "../utils/portalState";
import {
  AssistantIcon,
  CloseIcon,
  ComplaintIcon,
  LogoutIcon,
  MenuIcon,
  SearchIcon,
  SettingsIcon,
  TrackIcon,
} from "./PublicIcons";
import { useCitizenI18n } from "../i18n";

export default function CitizenLayout({
  menu,
  setMenu,
  userName,
  children,
  noticeKey,
  onDismissNotice,
  onLoggedOut,
}) {
  const { t } = useCitizenI18n();
  const [loggingOut, setLoggingOut] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const handleSelectMenu = (nextMenu) => {
    setMenu(nextMenu);
    setActiveCitizenTab(nextMenu);
    setDrawerOpen(false);
  };

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    postCitizenMobileLogout();
    await clearCitizenSession();
    onLoggedOut();
  };

  const navItems = [
    { key: "submit", label: t("layout.submit"), icon: ComplaintIcon },
    { key: "guide", label: t("layout.guide"), icon: AssistantIcon },
    { key: "track", label: t("layout.track"), icon: TrackIcon },
    { key: "settings", label: t("layout.settings"), icon: SettingsIcon },
  ];

  return (
    <div className="citizen-shell">
      <div className="navbar">
        <div className="navbar-brand">
          <div className="navbar-logo">C</div>
          <div>
            <div className="navbar-name">{t("portal.brand")}</div>
            <div className="navbar-sub">{t("portal.citizen")}</div>
          </div>
        </div>

        <div className="nav-tabs">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-tab ${menu === item.key ? "active" : ""}`}
              onClick={() => handleSelectMenu(item.key)}
            >
              <item.icon size={16} className="nav-tab-icon" />
              {item.label}
            </button>
          ))}
        </div>

        <div className="navbar-right">
          <span className="nav-user">{userName}</span>
          <button className="nav-logout" onClick={handleLogout} disabled={loggingOut}>
            <LogoutIcon size={16} />
            {loggingOut ? t("layout.loggingOut") : t("layout.logout")}
          </button>
        </div>

        <button
          type="button"
          className="citizen-menu-toggle"
          onClick={() => setDrawerOpen((value) => !value)}
          aria-label={drawerOpen ? t("layout.closeMenu") : t("layout.openMenu")}
          aria-expanded={drawerOpen}
        >
          {drawerOpen ? <CloseIcon size={18} /> : <MenuIcon size={18} />}
        </button>
      </div>

      <div className={`citizen-drawer-backdrop ${drawerOpen ? "is-open" : ""}`} onClick={() => setDrawerOpen(false)}>
        <aside className={`citizen-drawer ${drawerOpen ? "is-open" : ""}`} onClick={(event) => event.stopPropagation()}>
          <div className="citizen-drawer-header">
            <button
              type="button"
              className="citizen-menu-toggle citizen-menu-toggle-inline citizen-drawer-menu-circle"
              onClick={() => setDrawerOpen(false)}
              aria-label={t("layout.closeMenu")}
            >
              <MenuIcon size={19} />
            </button>
            <button
              type="button"
              className="citizen-drawer-search"
              onClick={() => handleSelectMenu("track")}
              aria-label={t("layout.track")}
            >
              <SearchIcon size={18} />
            </button>
          </div>

          <div className="citizen-drawer-brand">
            <div className="navbar-logo">C</div>
            <div>
              <div className="navbar-name">{t("portal.brand")}</div>
              <div className="navbar-sub">{t("portal.citizen")}</div>
            </div>
          </div>

          <div className="citizen-drawer-nav">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`citizen-drawer-link ${menu === item.key ? "active" : ""}`}
                onClick={() => handleSelectMenu(item.key)}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="citizen-drawer-footer">
            <div className="citizen-drawer-user">{userName}</div>
            <button className="nav-logout citizen-drawer-logout" onClick={handleLogout} disabled={loggingOut}>
              <LogoutIcon size={16} />
              {loggingOut ? t("layout.loggingOut") : t("layout.logout")}
            </button>
          </div>
        </aside>
      </div>

      {noticeKey ? (
        <div className="container citizen-notice-wrap">
          <div className="alert alert-success citizen-inline-notice">
            <span>{t(noticeKey)}</span>
            <button type="button" className="citizen-inline-notice-close" onClick={onDismissNotice}>
              {t("common.close")}
            </button>
          </div>
        </div>
      ) : null}

      <div>{children}</div>
    </div>
  );
}
