import React from "react";
import { CheckCircleIcon, AlertTriangleIcon, AlertCircleIcon } from "./icons";

// status: "success" (green) | "pending" (amber) | "error" (red, rare by design)
const CONFIG = {
  success: { style: "bg-primaryGreen/15 text-primaryGreen border-primaryGreen/40", Icon: CheckCircleIcon },
  pending: { style: "bg-amber/15 text-amber border-amber/40", Icon: AlertTriangleIcon },
  error: { style: "bg-deepRed/15 text-deepRed border-deepRed/40", Icon: AlertCircleIcon },
};

export default function StatusBanner({ status = "pending", children }) {
  if (!children) return null;
  const { style, Icon } = CONFIG[status] ?? CONFIG.pending;
  return (
    <div
      className={`w-full rounded-xl border px-4 py-3 flex items-center justify-center gap-2 text-lg font-semibold text-center animate-fade-in ${style}`}
    >
      <Icon className="shrink-0" />
      <span>{children}</span>
    </div>
  );
}
