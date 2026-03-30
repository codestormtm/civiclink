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
          background: "var(--sl-maroon-900)", color: "var(--sl-white)",
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
        background: isUser ? "var(--sl-green-900)" : "rgba(255, 255, 255, 0.96)",
        color: isUser ? "var(--sl-white)" : "var(--sl-ink-900)",
        fontSize: 13,
        lineHeight: 1.6,
        boxShadow: "0 8px 18px rgba(77, 34, 12, 0.1)",
        border: isUser ? "none" : "1px solid var(--sl-line)",
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
        background: "var(--sl-maroon-900)", color: "var(--sl-white)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700, flexShrink: 0,
      }}>
        C
      </div>
      <div style={{
        padding: "10px 16px", background: "rgba(255, 255, 255, 0.96)", border: "1px solid var(--sl-line)",
        borderRadius: "16px 16px 16px 4px", display: "flex", gap: 4, alignItems: "center",
      }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: "50%", background: "var(--sl-maroon-900)",
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
        background: "linear-gradient(180deg, #fff7e4 0%, #fffdf8 100%)", minHeight: 0,
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
        background: "rgba(255, 250, 241, 0.98)",
        borderTop: "1px solid var(--sl-line)",
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
            border: "1px solid var(--sl-line)", borderRadius: 10,
            fontFamily: "inherit", resize: "none",
            background: inputDisabled ? "#f7efe0" : "var(--sl-white)",
            color: "var(--sl-ink-900)",
            outline: "none",
          }}
        />
        <button
          onClick={handleSendClick}
          disabled={inputDisabled}
          style={{
            padding: "0 18px", fontSize: 20, background: "var(--sl-maroon-900)",
            color: "var(--sl-white)", border: "none", borderRadius: 10,
            cursor: inputDisabled ? "not-allowed" : "pointer",
            opacity: inputDisabled ? 0.5 : 1,
            flexShrink: 0,
            boxShadow: inputDisabled ? "none" : "0 10px 20px rgba(138, 21, 56, 0.18)",
          }}
        >
          {"\u27A4"}
        </button>
      </div>
    </div>
  );
}
