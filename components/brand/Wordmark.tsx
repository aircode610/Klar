import { cn } from "@/lib/utils";

/** The Klar wordmark, set in Clash Display with the lime accent dot. */
export function Wordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "text-xl", md: "text-2xl", lg: "text-4xl" };
  return (
    <span
      className={cn("inline-flex items-baseline font-semibold text-ink", sizes[size], className)}
      style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
    >
      Klar
      <span className="ms-0.5 inline-block size-[0.3em] translate-y-[-0.05em] rounded-full bg-brand" aria-hidden />
    </span>
  );
}
