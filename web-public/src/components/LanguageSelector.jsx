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
            border: value === l.code ? "none" : "1px solid #d1d5db",
            background: value === l.code ? "#1a56db" : "#fff",
            color: value === l.code ? "#fff" : "#374151",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
            fontFamily: "inherit",
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
