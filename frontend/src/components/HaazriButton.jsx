import React from "react";

export default function HaazriButton({ label, onPress, disabled = false }) {
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      className="w-56 h-56 rounded-full text-background text-2xl font-display font-bold
                 bg-primaryGreen border-[3px] border-background
                 shadow-[8px_8px_0_0_#000]
                 active:translate-x-[4px] active:translate-y-[4px] active:shadow-[4px_4px_0_0_#000]
                 transition-[transform,box-shadow] duration-100
                 disabled:opacity-50 disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:active:shadow-[8px_8px_0_0_#000]
                 flex items-center justify-center text-center px-4 uppercase tracking-tight"
    >
      {label}
    </button>
  );
}
