"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReadingLoader } from "@/components/brand/ReadingLoader";
import * as api from "@/lib/api";

/**
 * Return route after the Mollie hosted checkout (live flow). Polls the payment,
 * then bounces back into the app. In mock mode the paywall resolves inline, so
 * this is here mainly for the live redirect path.
 */
function ReturnInner() {
  const router = useRouter();
  const params = useSearchParams();
  const paymentId = params.get("paymentId");

  useEffect(() => {
    if (!paymentId) {
      router.replace("/letters");
      return;
    }
    let active = true;
    const poll = async () => {
      try {
        const { status } = await api.getPayment(paymentId);
        if (!active) return;
        if (status === "paid" || status === "failed" || status === "canceled") {
          router.replace("/letters");
          return;
        }
        setTimeout(poll, 1200);
      } catch {
        if (active) router.replace("/letters");
      }
    };
    poll();
    return () => {
      active = false;
    };
  }, [paymentId, router]);

  return <ReadingLoader />;
}

export default function PayReturnPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-6">
      <Suspense fallback={<ReadingLoader />}>
        <ReturnInner />
      </Suspense>
    </div>
  );
}
