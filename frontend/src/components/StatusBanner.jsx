import React from "react";

// status: "success" (green) | "pending" (amber) | "error" (red, rare by design)
const STYLES = {
  success: "bg-primaryGreen/20 text-primaryGreen border-primaryGreen",
  pending: "bg-amber/20 text-amber border-amber",
  error: "bg-deepRed/20 text-deepRed border-deepRed",
};

export default function StatusBanner({ status = "pending", children }) {
  if (!children) return null;
  return (
    <div className={`w-full rounded-xl border px-4 py-3 text-lg font-semibold text-center ${STYLES[status]}`}>
      {children}
    </div>
  );
}
