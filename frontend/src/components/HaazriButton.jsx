import React from "react";

export default function HaazriButton({ label, onPress, disabled = false }) {
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      className="w-56 h-56 rounded-full bg-primaryGreen text-textPrimary text-2xl font-bold
                 shadow-lg active:scale-95 transition-transform
                 disabled:opacity-50 disabled:active:scale-100
                 flex items-center justify-center text-center px-4"
    >
      {label}
    </button>
  );
}
