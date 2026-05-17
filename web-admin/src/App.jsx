import { useCallback, useEffect, useRef, useState } from "react";
import api from "./api/api";
import { connectAdminSocket, disconnectAdminSocket, syncSocketAuth } from "./api/socket";
import socket from "./api/socket";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Workers from "./pages/Workers";
import DepartmentReports from "./pages/DepartmentReports";
import SystemAdmin from "./pages/SystemAdmin";
import { clearAuth, getRole, getToken } from "./utils/auth";
import {
  decryptText,
  deriveLocalConversationKey,
  saveConversationKey,
  saveMessage,
} from "./communication/communicationStore";

function getBrowserNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return window.Notification.permission;
}

function App() {
  const [sessionReady, setSessionReady] = useState(false);
  const [role, setRole] = useState("");
  const [notificationPermission, setNotificationPermission] = useState(() => getBrowserNotificationPermission());
  const [communicationUnreadByComplaint, setCommunicationUnreadByComplaint] = useState({});
  const [communicationUnreadByWorker, setCommunicationUnreadByWorker] = useState({});
  const [pendingIncomingCall, setPendingIncomingCall] = useState(null);
  const communicationRingtoneRef = useRef(null);

  const playCommunicationSound = useCallback((soundPath) => {
    const audio = new Audio(soundPath);
    audio.play().catch(() => {});
    return audio;
  }, []);

  useEffect(() => {
    if (!["SYSTEM_ADMIN", "DEPT_ADMIN"].includes(role)) {
      disconnectAdminSocket();
      return undefined;
    }

    syncSocketAuth();
    connectAdminSocket();

    return () => {
      disconnectAdminSocket();
    };
  }, [role]);

  useEffect(() => {
    if (!["SYSTEM_ADMIN", "DEPT_ADMIN"].includes(role)) {
      return undefined;
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      return undefined;
    }

    if (window.Notification.permission === "default") {
      void window.Notification.requestPermission().then((permission) => {
        setNotificationPermission(permission);
      });
    }

    return undefined;
  }, [role]);

  useEffect(() => {
    if (!["SYSTEM_ADMIN", "DEPT_ADMIN"].includes(role)) {
      return undefined;
    }

    const handleRealtimeNotification = (payload) => {
      if (
        typeof window === "undefined"
        || !("Notification" in window)
        || notificationPermission !== "granted"
      ) {
        return;
      }

      const notification = new window.Notification(payload?.title || "CivicLink", {
        body: payload?.body || "You have a CivicLink update.",
        tag: payload?.channel || "civiclink-admin",
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    };

    socket.on("notification", handleRealtimeNotification);

    return () => {
      socket.off("notification", handleRealtimeNotification);
    };
  }, [notificationPermission, role]);

  useEffect(() => {
    if (!["SYSTEM_ADMIN", "DEPT_ADMIN"].includes(role)) {
      return undefined;
    }

    const handleCommunicationMessage = async (payload) => {
      if (!payload?.conversation_id || !payload?.conversation) return;

      try {
        const key = await deriveLocalConversationKey(payload.conversation);
        await saveConversationKey(payload.conversation_id, key);
        const plaintext = await decryptText(key, payload.ciphertext, payload.iv);
        await saveMessage({
          ...payload,
          direction: "inbound",
          status: "delivered",
          plaintext,
        });
        socket.emit("conversation:delivered", {
          conversation_id: payload.conversation_id,
          client_message_id: payload.client_message_id,
        });

        setCommunicationUnreadByWorker((current) => ({
          ...current,
          [payload.conversation.worker_user_id]: (current[payload.conversation.worker_user_id] || 0) + 1,
        }));
        if (payload.conversation.complaint_id) {
          setCommunicationUnreadByComplaint((current) => ({
            ...current,
            [payload.conversation.complaint_id]: (current[payload.conversation.complaint_id] || 0) + 1,
          }));
        }
        playCommunicationSound("/sounds/smooth_notification.mp3");

        if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted") {
          new window.Notification("CivicLink worker message", {
            body: plaintext,
            tag: `communication-${payload.conversation_id}`,
          });
        }
      } catch {
        if (payload?.conversation?.worker_user_id) {
          setCommunicationUnreadByWorker((current) => ({
            ...current,
            [payload.conversation.worker_user_id]: (current[payload.conversation.worker_user_id] || 0) + 1,
          }));
        }
      }
    };

    const handleIncomingCall = (payload) => {
      if (!payload?.conversation) return;
      setCommunicationUnreadByWorker((current) => ({
        ...current,
        [payload.conversation.worker_user_id]: (current[payload.conversation.worker_user_id] || 0) + 1,
      }));
      if (payload.conversation.complaint_id) {
        setCommunicationUnreadByComplaint((current) => ({
          ...current,
          [payload.conversation.complaint_id]: (current[payload.conversation.complaint_id] || 0) + 1,
        }));
      }
      setPendingIncomingCall(payload);

      communicationRingtoneRef.current?.pause();
      const ringtone = playCommunicationSound("/sounds/soft_ringtone.mp3");
      if (ringtone) {
        ringtone.loop = true;
        communicationRingtoneRef.current = ringtone;
        window.setTimeout(() => {
          ringtone.pause();
          ringtone.currentTime = 0;
          if (communicationRingtoneRef.current === ringtone) {
            communicationRingtoneRef.current = null;
          }
        }, 15000);
      }

      if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted") {
        new window.Notification("Incoming CivicLink call", {
          body: "Worker is calling.",
          tag: `call-${payload.call_id || payload.conversation_id}`,
        });
      }
    };

    const stopCommunicationRingtone = () => {
      communicationRingtoneRef.current?.pause();
      if (communicationRingtoneRef.current) {
        communicationRingtoneRef.current.currentTime = 0;
        communicationRingtoneRef.current = null;
      }
    };

    socket.on("conversation:message", handleCommunicationMessage);
    socket.on("call:request", handleIncomingCall);
    socket.on("call:accept", stopCommunicationRingtone);
    socket.on("call:reject", stopCommunicationRingtone);
    socket.on("call:end", stopCommunicationRingtone);

    return () => {
      socket.off("conversation:message", handleCommunicationMessage);
      socket.off("call:request", handleIncomingCall);
      socket.off("call:accept", stopCommunicationRingtone);
      socket.off("call:reject", stopCommunicationRingtone);
      socket.off("call:end", stopCommunicationRingtone);
    };
  }, [playCommunicationSound, role]);

  useEffect(() => {
    let active = true;

    async function bootstrapSession() {
      const token = getToken();
      const storedRole = getRole();

      if (!token) {
        if (active) {
          setRole("");
          setSessionReady(true);
        }
        return;
      }

      if (storedRole === "WORKER") {
        clearAuth();
        if (active) {
          setRole("");
          setSessionReady(true);
        }
        return;
      }

      try {
        const res = await api.get("/auth/me");
        const nextRole = res.data?.data?.role || "";

        if (!["SYSTEM_ADMIN", "DEPT_ADMIN"].includes(nextRole)) {
          clearAuth();
          if (active) {
            setRole("");
            setSessionReady(true);
          }
          return;
        }

        if (active) {
          setRole(nextRole);
          setSessionReady(true);
        }
      } catch {
        clearAuth();
        if (active) {
          setRole("");
          setSessionReady(true);
        }
      }
    }

    bootstrapSession();

    return () => {
      active = false;
    };
  }, []);

  const handleLoggedIn = (nextLoggedIn) => {
    if (!nextLoggedIn) {
      disconnectAdminSocket();
      clearAuth();
      setRole("");
      setSessionReady(true);
      return;
    }

    syncSocketAuth();
    setRole(getRole() || "");
    setSessionReady(true);
  };

  const clearCommunicationUnread = (complaintId) => {
    if (!complaintId) return;
    setCommunicationUnreadByComplaint((current) => ({
      ...current,
      [complaintId]: 0,
    }));
  };

  const clearWorkerCommunicationUnread = (workerId) => {
    if (!workerId) return;
    setCommunicationUnreadByWorker((current) => ({
      ...current,
      [workerId]: 0,
    }));
  };

  if (!sessionReady) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">CivicLink</div>
          <p className="login-subtitle">Checking admin session...</p>
        </div>
      </div>
    );
  }

  if (!role) {
    return <Login setLoggedIn={handleLoggedIn} />;
  }

  if (role === "SYSTEM_ADMIN") return <SystemAdmin />;

  if (role === "DEPT_ADMIN") {
    return (
      <Layout>
        {(menu) => {
          if (menu === "workers") {
            return (
              <Workers
                communicationUnreadByWorker={communicationUnreadByWorker}
                onCommunicationOpen={clearWorkerCommunicationUnread}
                pendingIncomingCall={pendingIncomingCall}
                onPendingIncomingCallOpen={() => setPendingIncomingCall(null)}
              />
            );
          }
          if (menu === "reports") return <DepartmentReports />;
          if (menu === "queue") return <Dashboard focus="queue" communicationUnreadByComplaint={communicationUnreadByComplaint} onCommunicationOpen={clearCommunicationUnread} />;
          if (menu === "map") return <Dashboard focus="map" communicationUnreadByComplaint={communicationUnreadByComplaint} onCommunicationOpen={clearCommunicationUnread} />;
          if (menu === "sla") return <Dashboard focus="sla" communicationUnreadByComplaint={communicationUnreadByComplaint} onCommunicationOpen={clearCommunicationUnread} />;
          return <Dashboard focus="overview" communicationUnreadByComplaint={communicationUnreadByComplaint} onCommunicationOpen={clearCommunicationUnread} />;
        }}
      </Layout>
    );
  }

  clearAuth();
  return <Login setLoggedIn={handleLoggedIn} />;
}

export default App;
