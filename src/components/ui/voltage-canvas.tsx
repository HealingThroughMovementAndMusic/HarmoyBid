// VoltageCanvas — the "Rationed Voltage Dark" ambient background: a
// near-imperceptible warm-to-black diagonal wash, functionally flat rather
// than a vivid hero gradient. Same shape as jade-sky.tsx's GradientBackground
// (position:relative outer div + position:absolute inner div) so it plugs
// into the identical grid-stacking usage in dashboard-layout.tsx — dark
// mode's counterpart to jade-sky.tsx's light-mode gradient, not a
// replacement for it.
export function VoltageCanvas({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#181818",
          backgroundImage: "linear-gradient(275deg, rgb(41, 41, 36) 0%, rgb(15, 15, 15) 100%)",
          backgroundAttachment: "fixed",
        }}
      />
    </div>
  );
}
