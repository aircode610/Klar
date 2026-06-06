import { cn } from "@/lib/utils";

/** Centred content container. `wide` for the calendar, default for reading. */
export function Screen({
  width = "default",
  className,
  children,
}: {
  width?: "default" | "wide" | "narrow";
  className?: string;
  children: React.ReactNode;
}) {
  const max =
    width === "wide" ? "max-w-5xl" : width === "narrow" ? "max-w-xl" : "max-w-2xl";
  return (
    <div
      className={cn("mx-auto w-full px-4 sm:px-6", max, className)}
      style={{ paddingTop: "max(env(safe-area-inset-top), 0px)" }}
    >
      {children}
    </div>
  );
}

/** Screen header: a mono eyebrow, a Clash-set title, and an optional action. */
export function PageHeader({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-end justify-between gap-3 pt-6 pb-4", className)}>
      <div>
        {eyebrow && (
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-ink-2">
            {eyebrow}
          </p>
        )}
        <h1
          className="mt-1 text-[1.75rem] font-bold leading-tight text-ink"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
        >
          {title}
        </h1>
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </header>
  );
}
