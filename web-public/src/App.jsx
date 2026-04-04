import { useCallback, useEffect, useState } from "react";
import api from "./api/api";
import CitizenLayout from "./components/CitizenLayout";
import { CitizenI18nProvider, translate } from "./i18n";
import GuidedReportPage from "./pages/GuidedReportPage";
import Login from "./pages/Login";
import CitizenComplaintForm from "./pages/CitizenComplaintForm";
import CitizenLanguageSetup from "./pages/CitizenLanguageSetup";
import CitizenSettings from "./pages/CitizenSettings";
import TrackComplaint from "./pages/TrackComplaint";
import PublicDashboard from "./pages/PublicDashboard";
import {
  clearAuth,
  getName,
  getPreferredLanguage,
  getRole,
  getToken,
  isCitizenAuthenticated,
  setAuth,
  setPreferredLanguage,
} from "./utils/auth";
import { getActiveCitizenTab, setActiveCitizenTab } from "./utils/portalState";
import { applyLanguage, getStoredLanguage, setStoredLanguage } from "./utils/language";

function buildStoredUser() {
  return {
    name: getName(),
    role: getRole(),
    preferred_language: getPreferredLanguage() || null,
  };
}

function App() {
  const [bootState, setBootState] = useState(() => (isCitizenAuthenticated() ? "booting" : "guest"));
  const [user, setUser] = useState(() => buildStoredUser());
  const [menu, setMenu] = useState(() => getActiveCitizenTab());
  const [language, setLanguage] = useState(() => getPreferredLanguage() || getStoredLanguage());
  const [authNoticeKey, setAuthNoticeKey] = useState("");
  const [settingsState, setSettingsState] = useState({ saving: false, error: "", success: "" });
  const [setupState, setSetupState] = useState({ saving: false, error: "" });
  const isPublicDashboardRoute = window.location.pathname === "/public";

  const applySelectedLanguage = useCallback((nextLanguage) => {
    setStoredLanguage(nextLanguage);
    setLanguage(nextLanguage);
  }, []);

  useEffect(() => {
    applyLanguage(language);
  }, [language]);

  useEffect(() => {
    if (!isCitizenAuthenticated()) {
      setBootState("guest");
      return;
    }

    let active = true;

    async function bootstrapSession() {
      try {
        const res = await api.get("/auth/me");
        const nextUser = res.data?.data;

        if (!nextUser || nextUser.role !== "CITIZEN") {
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

  const handleLoggedIn = (sessionPayload) => {
    const nextUser = {
      name: sessionPayload?.name || getName(),
      role: sessionPayload?.role || getRole(),
      preferred_language: sessionPayload?.preferred_language || null,
    };

    setUser(nextUser);
    setSettingsState({ saving: false, error: "", success: "" });
    setSetupState({ saving: false, error: "" });

    if (sessionPayload?.preferred_language) {
      setPreferredLanguage(sessionPayload.preferred_language);
      applySelectedLanguage(sessionPayload.preferred_language);
      setMenu("submit");
      setActiveCitizenTab("submit");
      setAuthNoticeKey("auth.success.signedIn");
      setBootState("authed");
    } else {
      setBootState("needs_language");
    }
  };

  const savePreferredLanguage = useCallback(async (nextLanguage) => {
    const res = await api.patch("/auth/preferences", { preferred_language: nextLanguage });
    const updatedUser = res.data?.data;

    setAuth({
      token: getToken(),
      role: updatedUser?.role || user.role,
      name: updatedUser?.name || user.name,
      preferred_language: updatedUser?.preferred_language || nextLanguage,
    });

    setPreferredLanguage(updatedUser?.preferred_language || nextLanguage);
    applySelectedLanguage(updatedUser?.preferred_language || nextLanguage);
    setUser((current) => ({
      ...current,
      ...updatedUser,
      preferred_language: updatedUser?.preferred_language || nextLanguage,
    }));
  }, [applySelectedLanguage, user.name, user.role]);

  const handleSetupContinue = async () => {
    if (!language) {
      setSetupState({ saving: false, error: translate(language, "setup.error") });
      return;
    }

    setSetupState({ saving: true, error: "" });

    try {
      await savePreferredLanguage(language);
      setBootState("authed");
      setMenu("submit");
      setActiveCitizenTab("submit");
      setSetupState({ saving: false, error: "" });
    } catch (err) {
      setSetupState({
        saving: false,
        error: err?.response?.data?.message || translate(language, "settings.error"),
      });
    }
  };

  const handleSaveSettings = async () => {
    setSettingsState({ saving: true, error: "", success: "" });

    try {
      await savePreferredLanguage(language);
      setSettingsState({ saving: false, error: "", success: translate(language, "settings.saved") });
    } catch (err) {
      setSettingsState({
        saving: false,
        error: err?.response?.data?.message || translate(language, "settings.error"),
        success: "",
      });
    }
  };

  const handleMenuChange = (nextMenu) => {
    setMenu(nextMenu);
    setActiveCitizenTab(nextMenu);
    setAuthNoticeKey("");
    setSettingsState((current) => ({ ...current, success: "" }));
  };

  const handleLoggedOut = () => {
    setUser(buildStoredUser());
    setMenu("submit");
    setActiveCitizenTab("submit");
    setAuthNoticeKey("");
    setBootState("guest");
  };

  if (isPublicDashboardRoute) {
    return <PublicDashboard />;
  }

  return (
    <CitizenI18nProvider language={language}>
      {bootState === "guest" ? (
        <Login onLoggedIn={handleLoggedIn} />
      ) : null}

      {bootState === "needs_language" ? (
        <CitizenLanguageSetup
          language={language}
          onLanguageChange={applySelectedLanguage}
          onContinue={handleSetupContinue}
          saving={setupState.saving}
          error={setupState.error}
        />
      ) : null}

      {bootState === "authed" ? (
        <CitizenLayout
          menu={menu}
          setMenu={handleMenuChange}
          userName={user.name}
          noticeKey={authNoticeKey}
          onDismissNotice={() => setAuthNoticeKey("")}
          onLoggedOut={handleLoggedOut}
        >
          {menu === "track" ? <TrackComplaint /> : null}
          {menu === "submit" ? <CitizenComplaintForm onOpenAi={() => handleMenuChange("guide")} onTrack={() => handleMenuChange("track")} /> : null}
          {menu === "guide" ? <GuidedReportPage language={language} onTrack={() => handleMenuChange("track")} /> : null}
          {menu === "settings" ? (
            <CitizenSettings
              language={language}
              onLanguageChange={applySelectedLanguage}
              onSave={handleSaveSettings}
              saving={settingsState.saving}
              error={settingsState.error}
              success={settingsState.success}
            />
          ) : null}
        </CitizenLayout>
      ) : null}
    </CitizenI18nProvider>
  );
}

export default App;
