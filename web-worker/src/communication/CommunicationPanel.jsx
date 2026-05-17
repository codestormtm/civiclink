import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/api";
import socket from "../api/socket";
import { getToken } from "../utils/auth";
import {
  createKeyPair,
  decodeJwtUserId,
  decryptText,
  deriveLocalConversationKey,
  deriveConversationKey,
  encryptText,
  exportEncryptedBackup,
  exportPublicKey,
  getMessages,
  importEncryptedBackup,
  saveConversationKey,
  saveMessage,
  updateMessageStatus,
} from "./communicationStore";

const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const NOTIFICATION_SOUND = "/sounds/smooth_notification.mp3";
const RINGTONE_SOUND = "/sounds/soft_ringtone.mp3";

function makeMessageId() {
  return `msg-${Date.now()}-${crypto.randomUUID()}`;
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function CommunicationPanel({
  assignmentId,
  complaintId,
  direct = false,
  localCallNumber = "",
  title,
  peerName,
  initialIncomingCall = null,
  onClose,
  onConversationReady,
}) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("Opening secure channel...");
  const [hasKey, setHasKey] = useState(false);
  const [typing, setTyping] = useState(false);
  const [callState, setCallState] = useState("idle");
  const [muted, setMuted] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);

  const currentUserId = decodeJwtUserId(getToken());
  const keyRef = useRef(null);
  const keyPairRef = useRef(null);
  const publicKeySentRef = useRef(false);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const notificationAudioRef = useRef(null);
  const ringtoneAudioRef = useRef(null);
  const activeCallIdRef = useRef("");
  const callTimeoutRef = useRef(null);
  const callStateRef = useRef("idle");
  const audioUnlockedRef = useRef(false);
  const initialIncomingCallRef = useRef(initialIncomingCall);
  const onConversationReadyRef = useRef(onConversationReady);

  const stopRingtone = useCallback(() => {
    const audio = ringtoneAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  const cleanupCall = useCallback(() => {
    if (callTimeoutRef.current) {
      window.clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    pendingIceCandidatesRef.current = [];
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    activeCallIdRef.current = "";
    stopRingtone();
  }, [stopRingtone]);

  const playNotificationSound = useCallback(() => {
    notificationAudioRef.current?.play().catch(() => {});
  }, []);

  const startRingtone = useCallback(() => {
    const audio = ringtoneAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.loop = true;
    audio.play().catch(() => {});
  }, []);

  const showBrowserNotification = useCallback((notificationTitle, body) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (window.Notification.permission === "granted") {
      new window.Notification(notificationTitle, { body, tag: "civiclink-communication" });
    }
  }, []);

  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;

    [notificationAudioRef.current, ringtoneAudioRef.current].forEach((audio) => {
      if (!audio) return;
      const previousMuted = audio.muted;
      audio.muted = true;
      audio.play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = previousMuted;
        })
        .catch(() => {
          audio.muted = previousMuted;
        });
    });
  }, []);

  const loadLocalMessages = useCallback(async (conversationId, key) => {
    const stored = await getMessages(conversationId);
    const hydrated = await Promise.all(stored.map(async (message) => {
      if (message.plaintext) return message;
      try {
        return { ...message, plaintext: await decryptText(key, message.ciphertext, message.iv) };
      } catch {
        return { ...message, plaintext: "[Unable to decrypt]" };
      }
    }));
    setMessages(hydrated);
    return hydrated;
  }, []);

  const emitPublicKey = useCallback(async (conversationId) => {
    if (!keyPairRef.current) {
      keyPairRef.current = await createKeyPair();
    }

    const public_key = await exportPublicKey(keyPairRef.current);
    socket.emit("conversation:key_public", { conversation_id: conversationId, public_key });
    publicKeySentRef.current = true;
  }, []);

  const createPeerConnection = useCallback(async (callId) => {
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionRef.current = pc;
    activeCallIdRef.current = callId;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && conversation?.id) {
        socket.emit("call:ice_candidate", {
          conversation_id: conversation.id,
          call_id: callId,
          candidate: event.candidate,
        });
      }
    };

    return pc;
  }, [conversation]);

  const flushPendingIceCandidates = useCallback(async (pc) => {
    if (!pc?.remoteDescription || pendingIceCandidatesRef.current.length === 0) return;
    const candidates = pendingIceCandidatesRef.current;
    pendingIceCandidatesRef.current = [];

    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // Ignore stale candidates after call renegotiation or end.
      }
    }
  }, []);

  const answerOffer = useCallback(async (payload, pc) => {
    if (!payload?.offer || !pc) return;
    await pc.setRemoteDescription(payload.offer);
    await flushPendingIceCandidates(pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("call:answer", { conversation_id: conversation.id, call_id: payload.call_id, answer });
    setCallState("connected");
  }, [conversation, flushPendingIceCandidates]);

  const acceptCall = useCallback(async (payload) => {
    if (!conversation?.id || !payload?.call_id) return;

    try {
      stopRingtone();
      setIncomingCall(null);
      setCallState("connecting");
      socket.emit("call:accept", { conversation_id: conversation.id, call_id: payload.call_id });
      const pc = await createPeerConnection(payload.call_id);

      if (payload.offer) {
        await answerOffer(payload, pc);
      }
    } catch {
      cleanupCall();
      setCallState("idle");
      setStatus("Unable to start microphone for this call.");
    }
  }, [answerOffer, cleanupCall, conversation, createPeerConnection, stopRingtone]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    onConversationReadyRef.current = onConversationReady;
  }, [onConversationReady]);

  useEffect(() => {
    return () => {
      cleanupCall();
    };
  }, [cleanupCall]);

  useEffect(() => {
    let active = true;

    async function openConversation() {
      try {
        const res = direct
          ? await api.post("/communication/direct-conversations", localCallNumber ? {
              local_call_number: localCallNumber,
            } : {})
          : await api.post("/communication/conversations", {
              assignment_id: assignmentId,
              complaint_id: complaintId,
            });
        const nextConversation = res.data.data;
        if (!active) return;

        setConversation(nextConversation);
        onConversationReadyRef.current?.(nextConversation);
        if (
          initialIncomingCallRef.current?.conversation_id === nextConversation.id
          || initialIncomingCallRef.current?.conversation?.id === nextConversation.id
        ) {
          setIncomingCall(initialIncomingCallRef.current);
          setCallState("ringing");
          startRingtone();
        }
        socket.emit("conversation:join", { conversation_id: nextConversation.id });

        const localKey = await deriveLocalConversationKey(nextConversation);
        keyRef.current = localKey;
        setHasKey(true);
        setStatus("Secure chat ready");
        await saveConversationKey(nextConversation.id, localKey);
        const localMessages = await loadLocalMessages(nextConversation.id, localKey);
        localMessages
          .filter((message) => message.sender_id !== currentUserId && message.status !== "seen")
          .forEach((message) => {
            socket.emit("conversation:seen", {
              conversation_id: nextConversation.id,
              client_message_id: message.client_message_id,
            });
            void updateMessageStatus(message.client_message_id, "seen");
          });

        await emitPublicKey(nextConversation.id);
      } catch (err) {
        setStatus(err?.response?.data?.error || "Unable to open conversation");
      }
    }

    void openConversation();
    return () => {
      active = false;
    };
  }, [assignmentId, complaintId, currentUserId, direct, emitPublicKey, loadLocalMessages, localCallNumber, startRingtone]);

  useEffect(() => {
    if (!conversation?.id || hasKey) return undefined;

    const retryId = window.setInterval(() => {
      socket.emit("conversation:join", { conversation_id: conversation.id });
      void emitPublicKey(conversation.id);
    }, 1000);

    return () => window.clearInterval(retryId);
  }, [conversation, emitPublicKey, hasKey]);

  useEffect(() => {
    if (!conversation?.id) return undefined;

    const handlePublicKey = async (payload) => {
      if (keyRef.current) return;
      if (payload.conversation_id !== conversation.id || payload.sender_id === currentUserId || !payload.public_key) return;
      if (!keyPairRef.current) keyPairRef.current = await createKeyPair();
      const key = await deriveConversationKey(keyPairRef.current.privateKey, payload.public_key);
      keyRef.current = key;
      setHasKey(true);
      await saveConversationKey(conversation.id, key);
      await loadLocalMessages(conversation.id, key);
      setStatus("Secure chat ready");
      if (!publicKeySentRef.current) await emitPublicKey(conversation.id);
    };

    const handleMessage = async (payload) => {
      if (payload.conversation_id !== conversation.id || payload.sender_id === currentUserId) return;
      if (!keyRef.current) {
        setStatus("Encrypted message received. Waiting for key exchange...");
        return;
      }

      const message = {
        ...payload,
        direction: "inbound",
        status: "seen",
        plaintext: await decryptText(keyRef.current, payload.ciphertext, payload.iv),
      };
      await saveMessage(message);
      setMessages((current) => (
        current.some((item) => item.client_message_id === message.client_message_id)
          ? current
          : [...current, message]
      ));
      playNotificationSound();
      showBrowserNotification(peerName || "CivicLink message", message.plaintext);
      socket.emit("conversation:seen", {
        conversation_id: conversation.id,
        client_message_id: payload.client_message_id,
      });
    };

    const handleSeen = async (payload) => {
      if (payload.conversation_id !== conversation.id || payload.sender_id === currentUserId) return;
      await updateMessageStatus(payload.client_message_id, "seen");
      setMessages((current) => current.map((message) => (
        message.client_message_id === payload.client_message_id
          ? { ...message, status: "seen" }
          : message
      )));
    };

    const handleDelivered = async (payload) => {
      if (payload.conversation_id !== conversation.id || payload.sender_id === currentUserId) return;
      await updateMessageStatus(payload.client_message_id, "delivered");
      setMessages((current) => current.map((message) => (
        message.client_message_id === payload.client_message_id && message.status !== "seen"
          ? { ...message, status: "delivered" }
          : message
      )));
    };

    const handleTyping = (payload) => {
      if (payload.conversation_id === conversation.id && payload.sender_id !== currentUserId) {
        setTyping(Boolean(payload.typing));
      }
    };

    const handlePresence = (payload) => {
      if (payload.conversation_id === conversation.id && payload.sender_id !== currentUserId) {
        void emitPublicKey(conversation.id);
      }
    };

    const handleJoined = (payload) => {
      if (payload.conversation_id === conversation.id) {
        void emitPublicKey(conversation.id);
      }
    };

    const handleCallRequest = (payload) => {
      if (payload.conversation_id === conversation.id && payload.sender_id !== currentUserId) {
        setIncomingCall(payload);
        setCallState("ringing");
        startRingtone();
        callTimeoutRef.current = window.setTimeout(() => {
          cleanupCall();
          setIncomingCall(null);
          setCallState("idle");
        }, 30000);
        showBrowserNotification("Incoming CivicLink call", `${peerName || "Department user"} is calling.`);
      }
    };

    const handleCallReject = () => {
      cleanupCall();
      setCallState("idle");
    };

    const handleCallEnd = () => {
      cleanupCall();
      setCallState("idle");
    };

    const handleOffer = async (payload) => {
      if (payload.conversation_id !== conversation.id || payload.sender_id === currentUserId) return;
      if (callStateRef.current === "ringing") {
        setIncomingCall((current) => ({ ...(current || {}), ...payload }));
        return;
      }
      if (callStateRef.current === "connecting" && peerConnectionRef.current) {
        await answerOffer(payload, peerConnectionRef.current);
      }
    };

    const handleAnswer = async (payload) => {
      if (payload.conversation_id !== conversation.id || payload.sender_id === currentUserId) return;
      await peerConnectionRef.current?.setRemoteDescription(payload.answer);
      await flushPendingIceCandidates(peerConnectionRef.current);
      setCallState("connected");
    };

    const handleIceCandidate = async (payload) => {
      if (payload.conversation_id !== conversation.id || payload.sender_id === currentUserId || !payload.candidate) return;
      const pc = peerConnectionRef.current;
      if (!pc?.remoteDescription) {
        pendingIceCandidatesRef.current.push(payload.candidate);
        return;
      }
      try {
        await pc.addIceCandidate(payload.candidate);
      } catch {
        // Ignore stale candidates after a call has ended.
      }
    };

    socket.on("conversation:key_public", handlePublicKey);
    socket.on("conversation:message", handleMessage);
    socket.on("conversation:delivered", handleDelivered);
    socket.on("conversation:seen", handleSeen);
    socket.on("conversation:typing", handleTyping);
    socket.on("conversation:presence", handlePresence);
    socket.on("conversation:joined", handleJoined);
    socket.on("call:request", handleCallRequest);
    socket.on("call:reject", handleCallReject);
    socket.on("call:end", handleCallEnd);
    socket.on("call:offer", handleOffer);
    socket.on("call:answer", handleAnswer);
    socket.on("call:ice_candidate", handleIceCandidate);

    return () => {
      socket.off("conversation:key_public", handlePublicKey);
      socket.off("conversation:message", handleMessage);
      socket.off("conversation:delivered", handleDelivered);
      socket.off("conversation:seen", handleSeen);
      socket.off("conversation:typing", handleTyping);
      socket.off("conversation:presence", handlePresence);
      socket.off("conversation:joined", handleJoined);
      socket.off("call:request", handleCallRequest);
      socket.off("call:reject", handleCallReject);
      socket.off("call:end", handleCallEnd);
      socket.off("call:offer", handleOffer);
      socket.off("call:answer", handleAnswer);
      socket.off("call:ice_candidate", handleIceCandidate);
    };
  }, [
    acceptCall,
    answerOffer,
    cleanupCall,
    conversation,
    currentUserId,
    emitPublicKey,
    flushPendingIceCandidates,
    loadLocalMessages,
    peerName,
    playNotificationSound,
    showBrowserNotification,
    startRingtone,
  ]);

  async function sendMessage() {
    unlockAudio();
    const text = draft.trim();
    if (!text || !conversation?.id || !keyRef.current) return;

    const encrypted = await encryptText(keyRef.current, text);
    const message = {
      conversation_id: conversation.id,
      client_message_id: makeMessageId(),
      sender_id: currentUserId,
      sent_at: new Date().toISOString(),
      direction: "outbound",
      plaintext: text,
      status: "sent",
      ...encrypted,
    };

    await saveMessage(message);
    setMessages((current) => [...current, message]);
    setDraft("");
    socket.emit("conversation:message", message);
  }

  function emitTyping(value) {
    if (!conversation?.id) return;
    socket.emit("conversation:typing", { conversation_id: conversation.id, typing: value });
  }

  async function startCall() {
    unlockAudio();
    if (!conversation?.id || callState !== "idle") return;

    try {
      const callId = `call-${Date.now()}-${crypto.randomUUID()}`;
      const pc = await createPeerConnection(callId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      setCallState("calling");
      socket.emit("call:request", { conversation_id: conversation.id, call_id: callId, offer });
      socket.emit("call:offer", { conversation_id: conversation.id, call_id: callId, offer });
      callTimeoutRef.current = window.setTimeout(() => {
        if (callStateRef.current === "calling") {
          socket.emit("call:end", { conversation_id: conversation.id, call_id: callId });
          cleanupCall();
          setCallState("idle");
        }
      }, 30000);
    } catch {
      cleanupCall();
      setCallState("idle");
      setStatus("Microphone permission is required for voice calls.");
    }
  }

  function rejectCall() {
    if (incomingCall?.call_id) {
      socket.emit("call:reject", { conversation_id: conversation.id, call_id: incomingCall.call_id });
    }
    cleanupCall();
    setIncomingCall(null);
    setCallState("idle");
  }

  function endCall() {
    if (conversation?.id && activeCallIdRef.current) {
      socket.emit("call:end", { conversation_id: conversation.id, call_id: activeCallIdRef.current });
    }
    cleanupCall();
    setCallState("idle");
  }

  function toggleMute() {
    const nextMuted = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  }

  async function handleExport() {
    const passphrase = window.prompt("Backup passphrase");
    if (!passphrase) return;
    const backup = await exportEncryptedBackup(passphrase);
    const blob = new Blob([backup], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "civiclink-communication-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const passphrase = window.prompt("Backup passphrase");
    if (!passphrase) return;
    await importEncryptedBackup(passphrase, await file.text());
    if (conversation?.id && keyRef.current) await loadLocalMessages(conversation.id, keyRef.current);
  }

  return (
    <div className="communication-backdrop" onPointerDown={unlockAudio}>
      <div className="communication-panel">
        <audio ref={notificationAudioRef} src={NOTIFICATION_SOUND} preload="auto" />
        <audio ref={ringtoneAudioRef} src={RINGTONE_SOUND} preload="auto" />

        <div className="communication-header">
          <div className="communication-avatar">{(peerName || title || "C")[0].toUpperCase()}</div>
          <div className="communication-title-block">
            <h2>{title || "CivicLink communication"}</h2>
            <p>{typing ? "typing..." : `${peerName || "Assigned team member"} - ${status}`}</p>
          </div>
          <div className="communication-header-actions">
            <button type="button" className="communication-icon-btn" onClick={startCall} disabled={callState !== "idle"} title="Voice call">Call</button>
            <button type="button" className="communication-icon-btn" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="communication-toolbar">
          {callState !== "idle" && callState !== "ringing" ? (
            <>
              <button type="button" onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>
              <button type="button" onClick={endCall}>End Call</button>
            </>
          ) : null}
          <button type="button" onClick={handleExport}>Export Backup</button>
          <label className="communication-file-btn">
            Import Backup
            <input type="file" accept="application/json" onChange={handleImport} />
          </label>
          <span>{callState === "idle" ? "No active call" : `Call: ${callState}`}</span>
        </div>

        {incomingCall ? (
          <div className="communication-call-card">
            <strong>Incoming voice call</strong>
            <button type="button" onClick={() => acceptCall(incomingCall)}>Accept</button>
            <button type="button" onClick={rejectCall}>Reject</button>
          </div>
        ) : null}

        <audio ref={remoteAudioRef} autoPlay />

        <div className="communication-messages">
          <div className="communication-day-pill">Today</div>
          {messages.length === 0 ? <p className="communication-empty">No local messages yet.</p> : null}
          {messages.map((message) => {
            const isMine = message.sender_id === currentUserId;
            return (
              <div
                key={message.client_message_id}
                className={`communication-message ${isMine ? "is-mine" : ""}`}
              >
                <p>{message.plaintext}</p>
                <span className="communication-message-meta">
                  {formatTime(message.sent_at)}
                  {isMine ? (
                    <>
                      <span className={`communication-ticks ${message.status === "seen" ? "is-seen" : ""}`}>
                        {message.status === "sent" ? "\u2713" : "\u2713\u2713"}
                      </span>
                      <span className="communication-status-text">
                        {message.status === "seen" ? "Seen" : "Sent"}
                      </span>
                    </>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>

        <div className="communication-compose">
          <textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              emitTyping(Boolean(event.target.value.trim()));
            }}
            onBlur={() => emitTyping(false)}
            placeholder={hasKey ? "Type a message" : "Waiting for secure key exchange..."}
            disabled={!hasKey}
          />
          <button type="button" className="communication-send-btn" onClick={sendMessage} disabled={!draft.trim() || !hasKey} aria-label="Send message">{"\u27a4"}</button>
        </div>
      </div>
    </div>
  );
}
