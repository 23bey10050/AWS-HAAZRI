import React from "react";

// Every screen renders inside this single wrapper so #root always has exactly one
// child — that's what lets the phone-frame CSS (index.css, desktop/wide viewports
// only) treat the whole app as one scrollable "screen," with BottomNav anchored to
// the bottom of THIS frame via `absolute` rather than `fixed` to the real browser
// window. On an actual phone the frame CSS never activates, so this is functionally
// identical to `fixed` there — full height, full bleed.
export default function AppShell({ children, nav }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden bg-background"
      style={{
        backgroundImage:
          "radial-gradient(circle at 15% 0%, rgba(34,197,94,0.14), transparent 35%), " +
          "radial-gradient(circle at 90% 100%, rgba(34,197,94,0.08), transparent 40%)",
      }}
    >
      <div className="h-full overflow-y-auto">{children}</div>
      {nav}
    </div>
  );
}
