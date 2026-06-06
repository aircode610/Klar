import { cn } from "@/lib/utils";

/**
 * Paper surface with a hairline border — the default way to group content.
 * Borders over shadows; optional faint grain for the document feel.
 */
export function Card({
  className,
  grain,
  inset,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  grain?: boolean;
  inset?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative rounded-[var(--radius-lg)] border border-line",
        inset ? "bg-surface-2" : "bg-surface",
        grain && "card-grain",
        className,
      )}
      {...props}
    />
  );
}
