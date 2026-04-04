function IconBase({ children, size = 18, strokeWidth = 1.8, className = "", ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function MenuIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </IconBase>
  );
}

export function CloseIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </IconBase>
  );
}

export function ComplaintIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M8 4.5h8" />
      <path d="M9 3h6v3H9z" />
      <path d="M8 7.5H6.5A1.5 1.5 0 0 0 5 9v10.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V9A1.5 1.5 0 0 0 17.5 7.5H16" />
      <path d="M8.5 12h7" />
      <path d="M8.5 16h5" />
    </IconBase>
  );
}

export function AssistantIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 3.5l1.4 3.1L16.5 8l-3.1 1.4L12 12.5l-1.4-3.1L7.5 8l3.1-1.4z" />
      <path d="M6 14.5l.8 1.7L8.5 17l-1.7.8L6 19.5l-.8-1.7L3.5 17l1.7-.8z" />
      <path d="M17.5 14.5l.8 1.7L20 17l-1.7.8-.8 1.7-.8-1.7L15 17l1.7-.8z" />
    </IconBase>
  );
}

export function TrackIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M4.5 12a7.5 7.5 0 1 0 15 0a7.5 7.5 0 1 0-15 0" />
      <path d="M12 7.5v5l3 1.8" />
    </IconBase>
  );
}

export function LogoutIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M9 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H9" />
      <path d="M14 16.5l4-4-4-4" />
      <path d="M10.5 12.5H18" />
    </IconBase>
  );
}

export function GlobeIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.8 12h16.4" />
      <path d="M12 3.5c2.4 2.3 3.7 5.3 3.7 8.5S14.4 18.2 12 20.5C9.6 18.2 8.3 15.2 8.3 12S9.6 5.8 12 3.5z" />
    </IconBase>
  );
}

export function LocationIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 20s6-4.6 6-10a6 6 0 1 0-12 0c0 5.4 6 10 6 10z" />
      <circle cx="12" cy="10" r="2.3" />
    </IconBase>
  );
}

export function CrosshairIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.8v2.4" />
      <path d="M12 18.8v2.4" />
      <path d="M2.8 12h2.4" />
      <path d="M18.8 12h2.4" />
    </IconBase>
  );
}

export function TrashIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M4.5 7h15" />
      <path d="M9.5 7V5.5h5V7" />
      <path d="M8 10v6.5" />
      <path d="M12 10v6.5" />
      <path d="M16 10v6.5" />
      <path d="M6 7l.8 11a1.5 1.5 0 0 0 1.5 1.4h7.4a1.5 1.5 0 0 0 1.5-1.4L18 7" />
    </IconBase>
  );
}

export function SendIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M4 12l15-7-3.5 14-4.1-5-7.4-2z" />
      <path d="M11.4 14L19 5" />
    </IconBase>
  );
}

export function CopyIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="8" y="8" width="10" height="11" rx="2" />
      <path d="M6.5 15H6A2 2 0 0 1 4 13V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v.5" />
    </IconBase>
  );
}

export function CheckIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M5.5 12.5l4 4L18.5 8" />
    </IconBase>
  );
}

export function ArrowRightIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M5 12h13" />
      <path d="M13 7l5 5-5 5" />
    </IconBase>
  );
}

export function EditIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M4.5 19.5l4.2-.8L18 9.4l-3.4-3.4-9.3 9.3-.8 4.2z" />
      <path d="M12.8 6.8l3.4 3.4" />
    </IconBase>
  );
}

export function ImageIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="4.5" y="5" width="15" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M19.5 15l-4.5-4.5L7 19" />
    </IconBase>
  );
}

export function SearchIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </IconBase>
  );
}

export function DownloadIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 4v10" />
      <path d="M8 10.5l4 4 4-4" />
      <path d="M5 19.5h14" />
    </IconBase>
  );
}

export function SettingsIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.1" />
      <path d="M12 19.1v2.1" />
      <path d="M21.2 12h-2.1" />
      <path d="M4.9 12H2.8" />
      <path d="M18.5 5.5l-1.5 1.5" />
      <path d="M7 17l-1.5 1.5" />
      <path d="M18.5 18.5L17 17" />
      <path d="M7 7L5.5 5.5" />
    </IconBase>
  );
}
