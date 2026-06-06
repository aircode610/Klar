export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-8 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-ink-2">
        Offline
      </p>
      <h1
        className="mt-3 text-[1.625rem] font-semibold text-ink"
        style={{ fontFamily: "var(--font-display)" }}
      >
        You are offline
      </h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-2">
        Letters you have already opened stay readable. New scans and payments
        need a connection — try again when you are back online.
      </p>
    </div>
  );
}
