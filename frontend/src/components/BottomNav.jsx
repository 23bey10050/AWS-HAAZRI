import React from "react";
import { HomeIcon, CalendarIcon, ProfileIcon } from "./icons";

const ICONS = { home: HomeIcon, calendar: CalendarIcon, profile: ProfileIcon };

// tabs: [{ key, label }]. Role-agnostic — App.jsx decides which tabs exist.
export default function BottomNav({ tabs, active, onChange }) {
  return (
    <nav className="absolute bottom-0 left-0 right-0 nav-safe-bottom bg-card border-t-[3px] border-textPrimary/90">
      <div className="flex">
        {tabs.map((tab) => {
          const Icon = ICONS[tab.key];
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className="relative flex-1 min-h-[64px] flex flex-col items-center justify-center gap-0.5"
            >
              {isActive && <span className="absolute top-0 h-1 w-10 bg-primaryGreen" />}
              {Icon && <Icon className={isActive ? "text-primaryGreen" : "text-textPrimary/50"} />}
              <span
                className={`text-xs font-display font-bold uppercase tracking-wide ${
                  isActive ? "text-primaryGreen" : "text-textPrimary/50"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
