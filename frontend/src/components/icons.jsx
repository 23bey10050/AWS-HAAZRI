import React from "react";

// Minimal hand-written outline icons (no icon-library dependency) — stroke color
// follows currentColor so BottomNav can drive active/inactive state via text color.
const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

export function HomeIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" className={className} {...base}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 9.8V20h13V9.8" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

export function CalendarIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" className={className} {...base}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3v3.5M16 3v3.5" />
      <circle cx="8.2" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="14" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ProfileIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" className={className} {...base}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.4-3.8 4.4-5.8 7.5-5.8s6.1 2 7.5 5.8" />
    </svg>
  );
}

export function CheckCircleIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5 5.5-6" />
    </svg>
  );
}

export function AlertTriangleIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className={className} {...base}>
      <path d="M12 4.5 21 19H3z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="16.7" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AlertCircleIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <circle cx="12" cy="16.3" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CameraIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" className={className} {...base}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </svg>
  );
}

export function MicIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" className={className} {...base}>
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0" />
      <path d="M12 17v3.5M9 20.5h6" />
    </svg>
  );
}

export function LogoutIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className={className} {...base}>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M15.5 16 20 12l-4.5-4" />
      <path d="M20 12H9" />
    </svg>
  );
}
