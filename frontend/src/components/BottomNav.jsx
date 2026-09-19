import React from "react";

// tabs: [{ key, label }]. Role-agnostic — the caller (App.jsx) decides which tabs exist
// via config/roleScreens.js, so this component never hardcodes role-specific names.
export default function BottomNav({ tabs, active, onChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-white/10 flex">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex-1 min-h-[64px] text-lg font-semibold ${
            active === tab.key ? "text-primaryGreen" : "text-textPrimary/60"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
