import { useEffect, useRef } from "react";
import LocationPickerCard from "./LocationPickerCard";

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 12,
    }}>
      {!isUser && (
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: "#1a56db", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, flexShrink: 0, marginRight: 8, marginTop: 2,
        }}>
          C
        </div>
      )}
      <div style={{
        maxWidth: "75%",
        padding: "10px 14px",
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        background: isUser ? "#1a56db" : "#fff",
        color: isUser ? "#fff" : "#111827",
        fontSize: 13,
        lineHeight: 1.6,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        border: isUser ? "none" : "1px solid #e5e7eb",
        whiteSpace: "pre-wrap",
      }}>
        {msg.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <div style={{
        width: 30, height: 30, borderRadius: "50%",
        background: "#1a56db", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700, flexShrink: 0,
      }}>
        C
      </div>
      <div style={{
        padding: "10px 16px", background: "#fff", border: "1px solid #e5e7eb",
        borderRadius: "16px 16px 16px 4px", display: "flex", gap: 4, alignItems: "center",
      }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: "50%", background: "#9ca3af",
            animation: "bounce 1.2s infinite",
            animationDelay: `${i * 0.2}s`,
          }} />
        ))}
      </div>
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function IntakeChat({ messages, onSend, typing, inputDisabled, locationPicker, onLocationPicked }) {
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val && !inputDisabled) {
        onSend(val);
        e.target.value = "";
      }
    }
  };

  const handleSendClick = () => {
    const val = inputRef.current?.value.trim();
    if (val && !inputDisabled) {
      onSend(val);
      inputRef.current.value = "";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{
        flex: 1, overflowY: "auto", padding: "16px 16px 8px",
        background: "#f9fafb", minHeight: 0,
      }}>
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}
        {locationPicker && !typing && (
          <LocationPickerCard onLocationPicked={onLocationPicked} />
        )}
        {typing && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      <div style={{
        padding: "12px 16px",
        background: "#fff",
        borderTop: "1px solid #e5e7eb",
        display: "flex", gap: 10,
      }}>
        <textarea
          ref={inputRef}
          placeholder="Type your message... (Enter to send)"
          disabled={inputDisabled}
          onKeyDown={handleKeyDown}
          rows={2}
          style={{
            flex: 1, fontSize: 13, padding: "10px 12px",
            border: "1px solid #d1d5db", borderRadius: 10,
            fontFamily: "inherit", resize: "none",
            background: inputDisabled ? "#f9fafb" : "#fff",
            color: "#111827",
            outline: "none",
          }}
        />
        <button
          onClick={handleSendClick}
          disabled={inputDisabled}
          style={{
            padding: "0 18px", fontSize: 20, background: "#1a56db",
            color: "#fff", border: "none", borderRadius: 10,
            cursor: inputDisabled ? "not-allowed" : "pointer",
            opacity: inputDisabled ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          {"\u27A4"}
        </button>
      </div>
    </div>
  );
}
