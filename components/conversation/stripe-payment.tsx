"use client";
import {
  loadStripePayment,
  type PaymentElements,
  type StripePaymentClient,
} from "@/lib/stripe-payment";
import { Button } from "@gorth-com/primitive/custom/button";
import { useEffect, useRef, useState } from "react";
import { useNetworkErrorToast } from "@/hooks/use-network-error-toast";
export function StripePayment({
  clientSecret,
  publishableKey,
  onComplete,
}: {
  clientSecret: string;
  publishableKey: string;
  onComplete: () => Promise<unknown>;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const client = useRef<StripePaymentClient | null>(null);
  const elements = useRef<PaymentElements | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const networkError = useNetworkErrorToast(error);
  useEffect(() => {
    let active = true;
    let destroy: (() => void) | undefined;
    void loadStripePayment()
      .then((factory) => {
        if (!active || !mount.current) return;
        client.current = factory(publishableKey);
        elements.current = client.current.elements({ clientSecret });
        const element = elements.current.create("payment");
        element.mount(mount.current);
        destroy = () => element.destroy();
        setReady(true);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Payment form failed",
          );
      });
    return () => {
      active = false;
      destroy?.();
    };
  }, [clientSecret, publishableKey]);
  const confirm = async () => {
    if (!client.current || !elements.current || pending) return;
    setPending(true);
    setError("");
    try {
      const result = await client.current.confirmPayment({
        elements: elements.current,
        confirmParams: { return_url: `${window.location.origin}/billing` },
        redirect: "if_required",
      });
      if (result.error)
        throw new Error(result.error.message ?? "Payment was not completed");
      await onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment failed");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div ref={mount} />
      {error && !networkError ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button disabled={!ready || pending} onClick={() => void confirm()}>
        {pending ? "Confirming…" : "Confirm payment"}
      </Button>
    </div>
  );
}
