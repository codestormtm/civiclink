import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from "firebase/auth";
import api from "../api/api";
import { API_BASE_URL } from "../api/config";
import LanguageSelector from "../components/LanguageSelector";
import { useCitizenI18n } from "../i18n";
import {
  auth,
  getFirebaseConfigError,
  googleProvider,
  isFirebaseConfigured,
} from "../firebase/client";
import { setAuth } from "../utils/auth";
import {
  clearPendingSignupLanguage,
  getPendingSignupLanguage,
  setPendingSignupLanguage,
} from "../utils/language";

const INITIAL_VERIFICATION_STATE = {
  email: "",
  visible: false,
};

const GOOGLE_REDIRECT_FALLBACK_CODES = new Set([
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
  "auth/popup-blocked",
]);

function shouldUseGoogleRedirect() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || "";
  const viewportWidth = Math.min(
    window.innerWidth || Number.MAX_SAFE_INTEGER,
    window.visualViewport?.width || Number.MAX_SAFE_INTEGER,
  );

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
    || window.matchMedia?.("(pointer: coarse)")?.matches
    || navigator.maxTouchPoints > 1
    || viewportWidth <= 900;
}

export default function Login({ onLoggedIn }) {
  const { t } = useCitizenI18n();
  const handledAuthEventRef = useRef("");
  const [tab, setTab] = useState("login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({
    name: "",
    email: "",
    password: "",
    preferred_language: getPendingSignupLanguage() || "en",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadingAction, setLoadingAction] = useState("");
  const [verificationState, setVerificationState] = useState(INITIAL_VERIFICATION_STATE);
  const firebaseConfigError = getFirebaseConfigError();

  const getFirebaseErrorMessage = (firebaseError, fallback) => {
    switch (firebaseError?.code) {
      case "auth/email-already-in-use":
        return "That email address is already in use.";
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/missing-password":
      case "auth/weak-password":
        return "Use a stronger password with at least 6 characters.";
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Invalid email or password.";
      case "auth/popup-closed-by-user":
        return "Google sign-in was cancelled before it finished.";
      case "auth/network-request-failed":
        return "Network error while contacting Firebase. Please try again.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a moment and try again.";
      default:
        return fallback;
    }
  };

  const getSessionExchangeErrorMessage = (requestError) => {
    if (requestError?.response?.data?.message) {
      return requestError.response.data.message;
    }

    if (requestError?.code === "ERR_NETWORK" || /Network Error|ERR_CONNECTION_REFUSED/i.test(requestError?.message || "")) {
      return t("auth.error.backendOffline", { url: API_BASE_URL });
    }

    return t("auth.error.backend");
  };

  const buildHandledAuthKey = (firebaseUser) => {
    if (!firebaseUser) {
      return "";
    }

    return [
      firebaseUser.uid,
      firebaseUser.metadata?.lastSignInTime || "",
      firebaseUser.providerData.map((provider) => provider.providerId).sort().join(","),
    ].join("::");
  };

  const exchangeFirebaseSession = async (firebaseUser, preferredLanguage) => {
    try {
      const idToken = await firebaseUser.getIdToken(true);
      const payload = { idToken };
      const pendingLanguage = preferredLanguage || getPendingSignupLanguage();

      if (pendingLanguage) {
        payload.preferred_language = pendingLanguage;
      }

      const res = await api.post("/auth/firebase/session", payload);
      setVerificationState(INITIAL_VERIFICATION_STATE);
      setAuth(res.data);
      clearPendingSignupLanguage();
      onLoggedIn(res.data);
    } catch (err) {
      handledAuthEventRef.current = "";
      if (auth?.currentUser) {
        await signOut(auth);
      }
      throw err;
    }
  };

  const syncSignedInUser = useEffectEvent(async (user, verificationMessage) => {
    await reload(user);
    const latestUser = auth.currentUser || user;
    const handledAuthKey = buildHandledAuthKey(latestUser);

    if (handledAuthKey && handledAuthEventRef.current === handledAuthKey) {
      return;
    }

    handledAuthEventRef.current = handledAuthKey;

    const signedInWithPassword = latestUser.providerData.some(
      (provider) => provider.providerId === "password",
    );
    const signedInWithGoogle = latestUser.providerData.some(
      (provider) => provider.providerId === "google.com",
    );

    if (signedInWithPassword && !latestUser.emailVerified) {
      setVerificationState({
        email: latestUser.email || "",
        visible: true,
      });
      setSuccess(verificationMessage);
      return;
    }

    if (latestUser.emailVerified || signedInWithGoogle) {
      await exchangeFirebaseSession(latestUser);
    }
  });

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      return undefined;
    }

    let isMounted = true;
    const handleFirebaseUser = async (firebaseUser) => {
      if (!isMounted || !firebaseUser) {
        return;
      }

      try {
        await syncSignedInUser(firebaseUser, t("auth.success.verifySent"));
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setError(getSessionExchangeErrorMessage(err));
      }
    };

    void (async () => {
      try {
        const redirectResult = await getRedirectResult(auth);

        if (!isMounted || !redirectResult?.user) {
          return;
        }

        await handleFirebaseUser(redirectResult.user);
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setError(
          err?.response?.data?.message
            || getSessionExchangeErrorMessage(err)
            || getFirebaseErrorMessage(err, t("auth.error.google")),
        );
      }
    })();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        return;
      }

      await handleFirebaseUser(user);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [onLoggedIn, syncSignedInUser, t]);

  const clearFeedback = () => {
    setError("");
    setSuccess("");
  };

  const beginAction = (action) => {
    clearFeedback();
    setLoadingAction(action);
  };

  const finishAction = () => {
    setLoadingAction("");
  };

  const showVerificationNotice = (email) => {
    setVerificationState({
      email: email || "",
      visible: true,
    });
    setSuccess(t("auth.success.verifySent"));
    setTab("login");
  };

  const handleLogin = async () => {
    if (!isFirebaseConfigured() || !auth) {
      setError(firebaseConfigError || t("auth.error.firebase"));
      return;
    }

    if (!loginForm.email || !loginForm.password) {
      setError(t("auth.error.loginRequired"));
      return;
    }

    try {
      beginAction("login");
      const credential = await signInWithEmailAndPassword(
        auth,
        loginForm.email.trim(),
        loginForm.password,
      );

      await reload(credential.user);
      const latestUser = auth.currentUser || credential.user;
      handledAuthEventRef.current = buildHandledAuthKey(latestUser);
      const signedInWithPassword = latestUser.providerData.some(
        (provider) => provider.providerId === "password",
      );

      if (signedInWithPassword && !latestUser.emailVerified) {
        showVerificationNotice(latestUser.email || loginForm.email.trim());
        return;
      }

      await exchangeFirebaseSession(latestUser);
    } catch (err) {
      setError(
        err?.response?.data?.message
          || getSessionExchangeErrorMessage(err)
          || getFirebaseErrorMessage(err, t("auth.error.emailPassword")),
      );
    } finally {
      finishAction();
    }
  };

  const handleRegister = async () => {
    if (!isFirebaseConfigured() || !auth) {
      setError(firebaseConfigError || t("auth.error.firebase"));
      return;
    }

    if (!regForm.name || !regForm.email || !regForm.password || !regForm.preferred_language) {
      setError(t("auth.error.registerRequired"));
      return;
    }

    try {
      beginAction("register");
      setPendingSignupLanguage(regForm.preferred_language);
      const credential = await createUserWithEmailAndPassword(
        auth,
        regForm.email.trim(),
        regForm.password,
      );
      handledAuthEventRef.current = buildHandledAuthKey(credential.user);

      if (regForm.name.trim()) {
        await updateProfile(credential.user, {
          displayName: regForm.name.trim(),
        });
      }

      await sendEmailVerification(credential.user);
      showVerificationNotice(credential.user.email || regForm.email.trim());
      setRegForm({
        name: "",
        email: "",
        password: "",
        preferred_language: regForm.preferred_language,
      });
    } catch (err) {
      setError(getFirebaseErrorMessage(err, t("auth.error.register")));
    } finally {
      finishAction();
    }
  };

  const handleGoogleLogin = async () => {
    if (!isFirebaseConfigured() || !auth || !googleProvider) {
      setError(firebaseConfigError || t("auth.error.firebase"));
      return;
    }

    try {
      beginAction("google");
      setVerificationState(INITIAL_VERIFICATION_STATE);

      if (shouldUseGoogleRedirect()) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      const credential = await signInWithPopup(auth, googleProvider);
      handledAuthEventRef.current = buildHandledAuthKey(credential.user);
      await exchangeFirebaseSession(credential.user);
    } catch (err) {
      if (GOOGLE_REDIRECT_FALLBACK_CODES.has(err?.code)) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      setVerificationState(INITIAL_VERIFICATION_STATE);
      setError(
        err?.response?.data?.message
          || getSessionExchangeErrorMessage(err)
          || getFirebaseErrorMessage(err, t("auth.error.google")),
      );
    } finally {
      finishAction();
    }
  };

  const handleForgotPassword = async () => {
    if (!isFirebaseConfigured() || !auth) {
      setError(firebaseConfigError || t("auth.error.firebase"));
      return;
    }

    if (!loginForm.email.trim()) {
      setError(t("auth.error.resetEmail"));
      return;
    }

    try {
      beginAction("reset");
      await sendPasswordResetEmail(auth, loginForm.email.trim());
      setSuccess(t("auth.success.reset"));
    } catch (err) {
      setError(getFirebaseErrorMessage(err, t("auth.error.reset")));
    } finally {
      finishAction();
    }
  };

  const handleResendVerification = async () => {
    if (!auth?.currentUser) {
      setError(t("auth.error.reauth"));
      return;
    }

    try {
      beginAction("verify");
      await sendEmailVerification(auth.currentUser);
      setSuccess(t("auth.success.verifyResent"));
    } catch (err) {
      setError(getFirebaseErrorMessage(err, t("auth.error.verification")));
    } finally {
      finishAction();
    }
  };

  const handleKey = (event) => {
    if (event.key === "Enter") {
      if (tab === "login") {
        handleLogin();
      } else {
        handleRegister();
      }
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-gov-header">
          <div className="auth-gov-title">{t("auth.govTitle")}</div>
        </div>

        <div className="auth-card">
          <div className="auth-brand-block">
            <div className="auth-logo">{t("portal.brand")}</div>
            <div className="auth-subtitle">{t("portal.citizen")}</div>
          </div>

          <div className="auth-segmented-control">
            {[
              { key: "login", label: t("auth.signIn") },
              { key: "register", label: t("auth.createAccount") },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setTab(item.key);
                  clearFeedback();
                }}
                className={`auth-segment-btn ${tab === item.key ? "is-active" : ""}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {error ? <div className="alert alert-error">{error}</div> : null}
          {success ? <div className="alert alert-success">{success}</div> : null}
          {firebaseConfigError ? <div className="alert alert-error">{firebaseConfigError}</div> : null}

          {verificationState.visible ? (
            <div className="auth-panel">
              <div className="auth-panel-title">{t("auth.verificationRequired")}</div>
              <p className="auth-panel-copy">
                {t("auth.verificationCopy", { email: verificationState.email })}
              </p>
              <button
                className="auth-link-btn"
                type="button"
                onClick={handleResendVerification}
                disabled={loadingAction === "verify"}
              >
                {loadingAction === "verify" ? t("auth.sendingVerification") : t("auth.resendVerification")}
              </button>
            </div>
          ) : null}

          {tab === "login" ? (
            <>
              <input
                className="auth-input"
                type="email"
                placeholder={t("auth.email")}
                value={loginForm.email}
                onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
                onKeyDown={handleKey}
              />
              <input
                className="auth-input"
                type="password"
                placeholder={t("auth.password")}
                value={loginForm.password}
                onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                onKeyDown={handleKey}
              />
              <button className="auth-btn" onClick={handleLogin} disabled={Boolean(loadingAction)}>
                {loadingAction === "login" ? t("auth.success.signingIn") : t("auth.signIn")}
              </button>
              <button
                type="button"
                className="auth-link-btn"
                onClick={handleForgotPassword}
                disabled={Boolean(loadingAction)}
              >
                {loadingAction === "reset" ? t("common.loading") : t("auth.forgotPassword")}
              </button>

              <div className="auth-divider-row">
                <span>or</span>
              </div>

              <button
                type="button"
                className="auth-btn auth-btn-secondary"
                onClick={handleGoogleLogin}
                disabled={Boolean(loadingAction)}
              >
                {loadingAction === "google" ? t("auth.success.google") : t("auth.continueGoogle")}
              </button>
              <div className="auth-helper-text">{t("auth.googleHelp")}</div>
            </>
          ) : (
            <>
              <input
                className="auth-input"
                type="text"
                placeholder={t("auth.fullName")}
                value={regForm.name}
                onChange={(event) => setRegForm({ ...regForm, name: event.target.value })}
                onKeyDown={handleKey}
              />
              <input
                className="auth-input"
                type="email"
                placeholder={t("auth.email")}
                value={regForm.email}
                onChange={(event) => setRegForm({ ...regForm, email: event.target.value })}
                onKeyDown={handleKey}
              />
              <input
                className="auth-input"
                type="password"
                placeholder={t("auth.createPassword")}
                value={regForm.password}
                onChange={(event) => setRegForm({ ...regForm, password: event.target.value })}
                onKeyDown={handleKey}
              />

              <div className="section-label auth-language-label">
                {t("auth.preferredLanguage")}
              </div>
              <LanguageSelector
                value={regForm.preferred_language}
                onChange={(nextLanguage) => setRegForm({ ...regForm, preferred_language: nextLanguage })}
                disabled={Boolean(loadingAction)}
              />

              <button className="auth-btn" onClick={handleRegister} disabled={Boolean(loadingAction)}>
                {loadingAction === "register" ? t("auth.success.registering") : t("auth.createAccount")}
              </button>
              <div className="auth-helper-text">{t("auth.registerHelp")}</div>
            </>
          )}

          <div className="auth-terms-copy">
            {t("auth.terms")}
          </div>
        </div>
      </div>
    </div>
  );
}
