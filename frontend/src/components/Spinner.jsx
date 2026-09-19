import React from "react";

export default function Spinner({ size = 28 }) {
  return (
    <div
      className="animate-spin-slow rounded-full border-[3px] border-white/15 border-t-primaryGreen"
      style={{ width: size, height: size }}
    />
  );
}
