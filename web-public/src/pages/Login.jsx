import { useEffect, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import api from "../api/api";
import {
  auth,
  getFirebaseConfigError,
  googleProvider,
  isFirebaseConfigured,
} from "../firebase/client";
import { API_BASE_URL } from "../api/config";
import { setAuth } from "../utils/auth";

const INITIAL_VERIFICATION_STATE = {
  email: "",
  visible: false,
};

function getFirebaseErrorMessage(error, fallback) {
  switch (error?.code) {
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
}

function getSessionExchangeErrorMessage(error) {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  if (error?.code === "ERR_NETWORK" || /Network Error|ERR_CONNECTION_REFUSED/i.test(error?.message || "")) {
    return `CivicLink backend is not reachable at ${API_BASE_URL}. Start the backend service and try again.`;
  }

  return "Unable to create a CivicLink session. Check that the backend is running and Firebase Admin is configured.";
}

export default function Login({ setLoggedIn }) {
  const initialAuthCheckDoneRef = useRef(false);
  const [tab, setTab] = useState("login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadingAction, setLoadingAction] = useState("");
  const [verificationState, setVerificationState] = useState(INITIAL_VERIFICATION_STATE);
  const firebaseConfigError = getFirebaseConfigError();

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (initialAuthCheckDoneRef.current) {
        return;
      }

      initialAuthCheckDoneRef.current = true;

      if (!user) {
        return;
      }

      try {
        await reload(user);
        const latestUser = auth.currentUser || user;
        const signedInWithPassword = latestUser.providerData.some(
          (provider) => provider.providerId === "password"
        );
        const signedInWithGoogle = latestUser.providerData.some(
          (provider) => provider.providerId === "google.com"
        );

        if (signedInWithPassword && !latestUser.emailVerified) {
          setVerificationState({
            email: latestUser.email || "",
            visible: true,
          });
          setSuccess("Check your inbox and verify your email before signing in.");
          return;
        }

        if (latestUser.emailVerified || signedInWithGoogle) {
          try {
            const idToken = await latestUser.getIdToken(true);
            const res = await api.post("/auth/firebase/session", { idToken });
            setAuth(res.data);
            setLoggedIn(true);
          } catch (err) {
            if (auth?.currentUser) {
              await signOut(auth);
            }
            throw err;
          }
        }
      } catch (err) {
        setError(getSessionExchangeErrorMessage(err));
      }
    });

    return unsubscribe;
  }, [setLoggedIn]);

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
    setSuccess("Verification email sent. Verify your address, then sign in to continue.");
    setTab("login");
  };

  const exchangeFirebaseSession = async (firebaseUser) => {
    try {
      const idToken = await firebaseUser.getIdToken(true);
      const res = await api.post("/auth/firebase/session", { idToken });
      setVerificationState(INITIAL_VERIFICATION_STATE);
      setAuth(res.data);
      setLoggedIn(true);
    } catch (err) {
      if (auth?.currentUser) {
        await signOut(auth);
      }
      throw err;
    }
  };

  const handleLogin = async () => {
    if (!isFirebaseConfigured() || !auth) {
      setError(firebaseConfigError || "Firebase login is not configured.");
      return;
    }

    if (!loginForm.email || !loginForm.password) {
      setError("Enter your email and password.");
      return;
    }

    try {
      beginAction("login");
      const credential = await signInWithEmailAndPassword(
        auth,
        loginForm.email.trim(),
        loginForm.password
      );

      await reload(credential.user);
      const latestUser = auth.currentUser || credential.user;
      const signedInWithPassword = latestUser.providerData.some(
        (provider) => provider.providerId === "password"
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
          || getFirebaseErrorMessage(err, "Unable to sign in with email and password.")
      );
    } finally {
      finishAction();
    }
  };

  const handleRegister = async () => {
    if (!isFirebaseConfigured() || !auth) {
      setError(firebaseConfigError || "Firebase login is not configured.");
      return;
    }

    if (!regForm.name || !regForm.email || !regForm.password) {
      setError("Enter your full name, email, and password.");
      return;
    }

    try {
      beginAction("register");
      const credential = await createUserWithEmailAndPassword(
        auth,
        regForm.email.trim(),
        regForm.password
      );

      if (regForm.name.trim()) {
        await updateProfile(credential.user, {
          displayName: regForm.name.trim(),
        });
      }

      await sendEmailVerification(credential.user);
      showVerificationNotice(credential.user.email || regForm.email.trim());
      setRegForm({ name: "", email: "", password: "" });
    } catch (err) {
      setError(getFirebaseErrorMessage(err, "Unable to create your account."));
    } finally {
      finishAction();
    }
  };

  const handleGoogleLogin = async () => {
    if (!isFirebaseConfigured() || !auth || !googleProvider) {
      setError(firebaseConfigError || "Firebase login is not configured.");
      return;
    }

    try {
      beginAction("google");
      setVerificationState(INITIAL_VERIFICATION_STATE);
      const credential = await signInWithPopup(auth, googleProvider);
      await exchangeFirebaseSession(credential.user);
    } catch (err) {
      setVerificationState(INITIAL_VERIFICATION_STATE);
      setError(
        err?.response?.data?.message
          || getSessionExchangeErrorMessage(err)
          || getFirebaseErrorMessage(err, "Unable to sign in with Google.")
      );
    } finally {
      finishAction();
    }
  };

  const handleForgotPassword = async () => {
    if (!isFirebaseConfigured() || !auth) {
      setError(firebaseConfigError || "Firebase login is not configured.");
      return;
    }

    if (!loginForm.email.trim()) {
      setError("Enter your email address first.");
      return;
    }

    try {
      beginAction("reset");
      await sendPasswordResetEmail(auth, loginForm.email.trim());
      setSuccess("Password reset email sent. Check your inbox for the reset link.");
    } catch (err) {
      setError(getFirebaseErrorMessage(err, "Unable to send the password reset email."));
    } finally {
      finishAction();
    }
  };

  const handleResendVerification = async () => {
    if (!auth?.currentUser) {
      setError("Sign in again with your email and password to resend verification.");
      return;
    }

    try {
      beginAction("verify");
      await sendEmailVerification(auth.currentUser);
      setSuccess("Verification email sent again. Check your inbox and spam folder.");
    } catch (err) {
      setError(getFirebaseErrorMessage(err, "Unable to resend the verification email."));
    } finally {
      finishAction();
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") {
      tab === "login" ? handleLogin() : handleRegister();
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-gov-header">
        <div className="auth-gov-title">Government of Sri Lanka - CivicLink</div>
      </div>

      <div className="auth-card">
        <div
          style={{
            display: "flex",
            background: "#f7ebd0",
            borderRadius: 10,
            padding: 4,
            marginBottom: 24,
            gap: 4,
          }}
        >
          {[
            { key: "login", label: "Sign In" },
            { key: "register", label: "Create Account" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                clearFeedback();
              }}
              style={{
                flex: 1,
                padding: "9px 0",
                border: "none",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
                background: tab === t.key ? "var(--sl-white)" : "transparent",
                color: tab === t.key ? "var(--sl-green-900)" : "var(--sl-muted-500)",
                boxShadow: tab === t.key ? "0 1px 3px rgba(77, 34, 12, 0.1)" : "none",
                fontFamily: "inherit",
                width: "auto",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        {firebaseConfigError && <div className="alert alert-error">{firebaseConfigError}</div>}

        {verificationState.visible && (
          <div className="auth-panel">
            <div className="auth-panel-title">Email verification required</div>
            <p className="auth-panel-copy">
              Verify <strong>{verificationState.email}</strong> before CivicLink creates your citizen session.
            </p>
            <button
              className="auth-link-btn"
              type="button"
              onClick={handleResendVerification}
              disabled={loadingAction === "verify"}
            >
              {loadingAction === "verify" ? "Sending verification..." : "Resend verification email"}
            </button>
          </div>
        )}

        {tab === "login" ? (
          <>
            <input
              className="auth-input"
              type="email"
              placeholder="Email address"
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              onKeyDown={handleKey}
            />
            <input
              className="auth-input"
              type="password"
              placeholder="Password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              onKeyDown={handleKey}
            />
            <button className="auth-btn" onClick={handleLogin} disabled={Boolean(loadingAction)}>
              {loadingAction === "login" ? "Signing in..." : "Sign In"}
            </button>
            <button
              type="button"
              className="auth-link-btn"
              onClick={handleForgotPassword}
              disabled={Boolean(loadingAction)}
            >
              {loadingAction === "reset" ? "Sending reset link..." : "Forgot password?"}
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
              {loadingAction === "google" ? "Connecting Google..." : "Continue with Google"}
            </button>
            <div className="auth-helper-text">
              Google users can continue immediately. Email/password users must verify their email first.
            </div>
          </>
        ) : (
          <>
            <input
              className="auth-input"
              type="text"
              placeholder="Full name"
              value={regForm.name}
              onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
              onKeyDown={handleKey}
            />
            <input
              className="auth-input"
              type="email"
              placeholder="Email address"
              value={regForm.email}
              onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
              onKeyDown={handleKey}
            />
            <input
              className="auth-input"
              type="password"
              placeholder="Create a password"
              value={regForm.password}
              onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
              onKeyDown={handleKey}
            />
            <button className="auth-btn" onClick={handleRegister} disabled={Boolean(loadingAction)}>
              {loadingAction === "register" ? "Creating account..." : "Create Account"}
            </button>
            <div className="auth-helper-text">
              We will send a verification email before your complaint portal access is activated.
            </div>
          </>
        )}

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: "#9ca3af" }}>
          By continuing you agree to the{" "}
          <span style={{ color: "var(--sl-green-900)" }}>Terms of Service</span>
        </div>
      </div>
    </div>
  );
}
