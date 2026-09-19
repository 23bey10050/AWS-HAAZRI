import React from "react";

export default function HaazriButton({ label, onPress, disabled = false }) {
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      className="w-56 h-56 rounded-full text-textPrimary text-2xl font-bold
                 bg-gradient-to-b from-primaryGreen to-emerald-600
                 shadow-[0_12px_32px_rgba(34,197,94,0.35)]
                 active:scale-95 active:shadow-[0_6px_16px_rgba(34,197,94,0.3)]
                 transition-all duration-150
                 disabled:opacity-50 disabled:active:scale-100 disabled:animate-none
                 flex items-center justify-center text-center px-4
                 ring-1 ring-white/10 animate-pulse-glow"
    >
      {label}
    </button>
  );
}
