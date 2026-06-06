"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Stamp } from "@/components/brand/Stamp";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/api";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAppStore((s) => s.setAuth);
  const onboarded = useAppStore((s) => s.onboarded);

  // Only honor `next` when it's a same-origin path. Refuse absolute URLs,
  // protocol-relative URLs (`//evil.com`), and anything that isn't a `/path`.
  // This is the canonical defense against open-redirect attacks via auth pages.
  const rawNext = searchParams.get("next");
  const safeNext =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === "signup";

  const validate = (): string | null => {
    if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (isSignup && password !== confirm) return "Passwords do not match.";
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = isSignup
        ? await api.signup({ email, password })
        : await api.login({ email, password });
      setAuth(res);
      // Signup with no onboarding → onboarding flow. Otherwise, honor `?next=`
      // from RequireAuth when present, falling back to /letters.
      const dest = isSignup && !onboarded ? "/onboarding" : (safeNext ?? "/letters");
      router.replace(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const guest = () => {
    setAuth({ user: { id: "guest", email: "guest@klar.app" } });
    router.replace(onboarded ? (safeNext ?? "/letters") : "/onboarding");
  };

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-10"
      style={{ paddingTop: "max(env(safe-area-inset-top), 2.5rem)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="relative mb-8">
          <Stamp
            label="KLAR"
            tone="ink"
            size="md"
            animate={false}
            className="absolute -top-3 end-0 opacity-10"
          />
          <Wordmark size="lg" />
          <h1
            className="mt-4 text-[1.75rem] font-bold leading-tight text-ink"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
          >
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-[0.9rem] text-ink-2">
            {isSignup
              ? "Start turning German letters into clarity."
              : "Sign in to pick up where you left off."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3" noValidate>
          <Field
            icon={Mail}
            type="email"
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <Field
            icon={Lock}
            type={show ? "text" : "password"}
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete={isSignup ? "new-password" : "current-password"}
            trailing={
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
                className="text-ink-2 hover:text-ink"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
          {isSignup && (
            <Field
              icon={Lock}
              type={show ? "text" : "password"}
              label="Confirm password"
              value={confirm}
              onChange={setConfirm}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          )}

          {error && (
            <p role="alert" className="text-[0.82rem] text-overdue">
              {error}
            </p>
          )}

          <Button type="submit" fullWidth size="lg" disabled={busy} className="mt-1">
            {busy ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Please wait…
              </>
            ) : isSignup ? (
              "Create account"
            ) : (
              "Sign in"
            )}
          </Button>
        </form>

        <div className="mt-5 text-center text-[0.875rem] text-ink-2">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-ink underline-offset-4 hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New to Klar?{" "}
              <Link href="/signup" className="font-semibold text-ink underline-offset-4 hover:underline">
                Create an account
              </Link>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="font-mono text-[0.62rem] uppercase tracking-wide text-ink-2">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <button
          onClick={guest}
          className="mt-4 w-full text-center text-[0.85rem] text-ink-2 underline-offset-4 hover:text-ink hover:underline"
        >
          Continue as guest
        </button>
      </motion.div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  onChange,
  trailing,
  ...props
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  onChange: (v: string) => void;
  trailing?: React.ReactNode;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[0.62rem] uppercase tracking-wide text-ink-2">
        {label}
      </span>
      <div
        className={cn(
          "flex items-center gap-2 rounded-(--radius-md) border border-line bg-surface px-3",
          "focus-within:border-ink/40",
        )}
      >
        <Icon size={17} strokeWidth={1.75} className="shrink-0 text-ink-2" aria-hidden />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 flex-1 bg-transparent text-[0.95rem] text-ink outline-none placeholder:text-ink-2/60"
          {...props}
        />
        {trailing}
      </div>
    </label>
  );
}
