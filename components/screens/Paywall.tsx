"use client";

import { useState } from "react";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PriceCard } from "@/components/ui/PriceCard";
import { Button } from "@/components/ui/Button";
import { useConfig } from "@/lib/hooks";
import * as api from "@/lib/api";
import { toast } from "@/components/ui/Toast";
import type { Letter } from "@/types";

type Selection = { kind: "document" } | { kind: "plan"; planId: string };

/**
 * Honest paywall: pay once for this letter, or subscribe to the flat rate.
 * Confirming runs the (mocked) Mollie checkout, then unlocks the content.
 */
export function Paywall({
  open,
  onClose,
  letter,
  onUnlocked,
}: {
  open: boolean;
  onClose: () => void;
  letter: Letter;
  onUnlocked: () => void;
}) {
  const { data: config } = useConfig();
  const [selection, setSelection] = useState<Selection>({ kind: "document" });
  const [paying, setPaying] = useState(false);

  const plan = config?.plans[0];
  const perLetter = letter.output.price ?? config?.perLetterPrice ?? null;

  const confirm = async () => {
    setPaying(true);
    try {
      const target =
        selection.kind === "document"
          ? ({ target: "document", documentId: letter.id } as const)
          : ({ target: "subscription", planId: selection.planId } as const);

      const { paymentId } = await api.checkout(target);
      // Live flow: window.location.href = checkoutUrl (Mollie hosted page).
      // Mock flow: poll the payment, which flips to paid and unlocks server-side.
      let status = "open";
      for (let i = 0; i < 6 && status !== "paid"; i++) {
        const res = await api.getPayment(paymentId);
        status = res.status;
      }
      if (status !== "paid") throw new Error("Payment not completed");
      toast.success("Klar. Handled.");
      onUnlocked();
      onClose();
    } catch {
      toast.error("Payment could not be completed.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Unlock your output">
      <p className="text-[0.9rem] text-ink-2">
        {letter.output.type === "filled_form"
          ? "We'll fill the correct form for you, ready to send."
          : "We'll write the correct reply for you, ready to send."}{" "}
        No subscription needed — pay once if you prefer.
      </p>

      <div className="mt-4 space-y-2.5">
        {perLetter && (
          <PriceCard
            title="Just this letter"
            price={perLetter}
            features={["One done-for-you document", "Yours to download and send"]}
            selected={selection.kind === "document"}
            onSelect={() => setSelection({ kind: "document" })}
          />
        )}
        {plan && (
          <PriceCard
            title={plan.name}
            price={plan.price}
            interval={plan.interval}
            badge="Best value"
            features={plan.features}
            selected={selection.kind === "plan"}
            onSelect={() => setSelection({ kind: "plan", planId: plan.id })}
          />
        )}
      </div>

      <Button fullWidth size="lg" className="mt-4" onClick={confirm} disabled={paying}>
        {paying ? (
          <>
            <Loader2 size={18} className="animate-spin" aria-hidden /> Contacting Mollie…
          </>
        ) : (
          <>
            <Lock size={17} strokeWidth={2} aria-hidden /> Continue to payment
          </>
        )}
      </Button>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-[0.72rem] text-ink-2">
        <ShieldCheck size={13} strokeWidth={2} aria-hidden /> Secure checkout via Mollie · test mode
      </p>
    </BottomSheet>
  );
}
