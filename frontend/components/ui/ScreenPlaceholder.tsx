/**
 * Temporary placeholder for screens not yet built (Phases 2–4). Confirms the
 * layout shell, fonts, and tokens render. Replaced screen-by-screen.
 */
export function ScreenPlaceholder({
  label,
  title,
  note,
}: {
  label: string;
  title: string;
  note?: string;
}) {
  return (
    <div className="px-5 pt-12">
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-ink-2">
        {label}
      </p>
      <h1
        className="mt-2 text-[1.625rem] font-semibold text-ink"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h1>
      {note ? (
        <p className="mt-3 max-w-prose text-[0.9375rem] leading-relaxed text-ink-2">
          {note}
        </p>
      ) : null}
      <div className="mt-6 h-px w-full bg-line" />
      <div className="mt-6 inline-flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5">
        <span className="size-2 rounded-full bg-brand" aria-hidden />
        <span className="font-mono text-xs text-ink-2">
          Foundation ready · build in progress
        </span>
      </div>
    </div>
  );
}
