const LANGS = [
  { code: "en", label: "English" },
  { code: "ta", label: "தமிழ்" },
  { code: "si", label: "සිංහල" },
];

export default function LanguageSelector({ value, onChange, disabled }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => onChange(l.code)}
          disabled={disabled}
          style={{
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 20,
            border: value === l.code ? "1px solid #6a0f2a" : "1px solid var(--sl-line)",
            background: value === l.code ? "var(--sl-maroon-900)" : "var(--sl-white)",
            color: value === l.code ? "var(--sl-white)" : "var(--sl-ink-700)",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
            fontFamily: "inherit",
            boxShadow: value === l.code ? "0 8px 18px rgba(138, 21, 56, 0.16)" : "none",
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
