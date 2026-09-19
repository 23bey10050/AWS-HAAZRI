import React from "react";
import { CheckCircleIcon, AlertTriangleIcon, AlertCircleIcon } from "./icons";

// status: "success" (green) | "pending" (amber) | "error" (red, rare by design)
const CONFIG = {
  success: { style: "bg-primaryGreen/10 text-primaryGreen border-primaryGreen", Icon: CheckCircleIcon },
  pending: { style: "bg-amber/10 text-amber border-amber", Icon: AlertTriangleIcon },
  error: { style: "bg-deepRed/10 text-deepRed border-deepRed", Icon: AlertCircleIcon },
};

export default function StatusBanner({ status = "pending", children }) {
  if (!children) return null;
  const { style, Icon } = CONFIG[status] ?? CONFIG.pending;
  return (
    <div
      className={`w-full rounded-lg border-2 px-4 py-3 flex items-center justify-center gap-2 text-lg font-bold text-center animate-fade-in ${style}`}
    >
      <Icon className="shrink-0" />
      <span>{children}</span>
    </div>
  );
}
