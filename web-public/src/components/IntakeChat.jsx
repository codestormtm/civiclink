import { useEffect, useRef } from "react";
import { useCitizenI18n } from "../i18n";
import LocationPickerCard from "./LocationPickerCard";
import { AssistantIcon, SendIcon } from "./PublicIcons";

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`intake-message-row ${isUser ? "is-user" : "is-assistant"}`}>
      {!isUser ? (
        <div className="intake-message-avatar">
          <AssistantIcon size={14} />
        </div>
      ) : null}
      <div className={`intake-message-bubble ${isUser ? "is-user" : "is-assistant"}`}>
        {msg.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="intake-typing-row">
      <div className="intake-message-avatar">
        <AssistantIcon size={14} />
      </div>
      <div className="intake-typing-bubble">
        {[0, 1, 2].map((index) => (
          <div key={index} className="intake-typing-dot" style={{ animationDelay: `${index * 0.2}s` }} />
        ))}
      </div>
    </div>
  );
}

export default function IntakeChat({ messages, onSend, typing, inputDisabled, locationPicker, onLocationPicked }) {
  const { t } = useCitizenI18n();
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const value = event.target.value.trim();
      if (value && !inputDisabled) {
        onSend(value);
        event.target.value = "";
      }
    }
  };

  const handleSendClick = () => {
    const value = inputRef.current?.value.trim();
    if (value && !inputDisabled) {
      onSend(value);
      inputRef.current.value = "";
    }
  };

  return (
    <div className="intake-chat">
      <div className="intake-chat-scroll">
        {messages.map((message, index) => (
          <Message key={index} msg={message} />
        ))}
        {locationPicker && !typing ? (
          <div className="intake-location-picker-wrap">
            <LocationPickerCard onLocationPicked={onLocationPicked} />
          </div>
        ) : null}
        {typing ? <TypingIndicator /> : null}
        <div ref={bottomRef} />
      </div>

      <div className="intake-chat-footer">
        {locationPicker ? (
          <div className="intake-chat-hint">{t("chat.locationHint")}</div>
        ) : null}
        <textarea
          ref={inputRef}
          placeholder={t("chat.input")}
          disabled={inputDisabled}
          onKeyDown={handleKeyDown}
          rows={2}
          className="intake-chat-input"
        />
        <button
          onClick={handleSendClick}
          disabled={inputDisabled}
          className="intake-send-btn"
          aria-label={t("chat.send")}
        >
          <SendIcon size={18} />
        </button>
      </div>
    </div>
  );
}
