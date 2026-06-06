import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-brand-ink border border-black/10 hover:brightness-[1.03] shadow-[0_1px_0_rgba(0,0,0,0.04)]",
  outline:
    "border border-ink/25 text-ink bg-transparent hover:bg-ink/[0.04]",
  ghost: "text-ink hover:bg-ink/[0.05] border border-transparent",
  danger: "bg-overdue text-white border border-black/10 hover:brightness-105",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-[0.8125rem]",
  md: "h-11 px-4 text-[0.9375rem]",
  lg: "h-14 px-6 text-[1.0625rem]",
};

export function buttonClasses(opts?: {
  variant?: Variant;
  size?: Size;
  className?: string;
}) {
  return cn(
    base,
    variants[opts?.variant ?? "primary"],
    sizes[opts?.size ?? "md"],
    opts?.className,
  );
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, fullWidth, className, ...props }, ref) => (
    <button
      ref={ref}
      className={buttonClasses({
        variant,
        size,
        className: cn(fullWidth && "w-full", className),
      })}
      {...props}
    />
  ),
);
Button.displayName = "Button";
