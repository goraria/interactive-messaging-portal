"use client"
import { useEffect, useState } from "react"
import { Button } from "@gorth-io/primitive/custom/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@gorth-io/primitive/default/card"
import { Spinner } from "@gorth-io/primitive/pattern/spinner"
import * as api from "@/services/client/chat-billing"
import { StripePayment } from "@/components/conversation/stripe-payment"
import { formatChatAmount } from "@/utils/chat-amount"
export default function ChatBilling() {
  const [data, setData] = useState<Awaited<
      ReturnType<typeof api.chatBillingSnapshot>
    > | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [provider, setProvider] = useState("momo"),
    [offset, setOffset] = useState(0)
  const [cardPayment, setCardPayment] = useState<{
    invoiceId: string
    paymentId: string
    clientSecret: string
    publishableKey: string
  } | null>(null)
  async function refresh() {
    try {
      setData(await api.chatBillingSnapshot(offset))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Billing unavailable")
    }
  }
  useEffect(() => {
    let stopped = false
    void api
      .chatBillingSnapshot(offset)
      .then((result) => {
        if (!stopped) {
          setData(result)
          setError(null)
        }
      })
      .catch(() => {
        if (!stopped)
          setError(
            "Billing services unavailable. Retry after configuring service access."
          )
      })
    return () => {
      stopped = true
    }
  }, [offset])
  async function act(operation: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await operation()
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Billing action failed")
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 overflow-auto p-6">
      <h1 className="text-2xl font-bold">Plans and billing</h1>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      <Button variant="outline" disabled={busy} onClick={() => void refresh()}>
        Reload
      </Button>
      {!data && !error ? <Spinner variant="infinite" /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {data?.catalog.flatMap((product) =>
          product.plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {plan.prices.map((price) => (
                  <Button
                    key={price.id}
                    disabled={busy}
                    onClick={() => void act(() => api.chatSubscribe(price.id))}
                  >
                    {formatChatAmount(price.unitAmount, price.currency)} /{" "}
                    {price.interval}
                  </Button>
                ))}
              </CardContent>
            </Card>
          ))
        )}
        {data && !data.catalog.length ? (
          <p>No paid plans are currently offered.</p>
        ) : null}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.subscriptions.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span>
                {item.status}
                {item.cancelAtPeriodEnd ? " · Ends this period" : ""}
              </span>
              <Button
                variant="outline"
                disabled={
                  busy || ["cancelled", "expired"].includes(item.status)
                }
                onClick={() => {
                  if (
                    item.cancelAtPeriodEnd ||
                    window.confirm("Cancel at the end of this billing period?")
                  )
                    void act(() =>
                      api.chatCancelSubscription(
                        item.id,
                        item.cancelAtPeriodEnd
                      )
                    )
                }}
              >
                {item.cancelAtPeriodEnd ? "Resume" : "Cancel"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            aria-label="Payment provider"
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
          >
            {["momo", "zalopay", "vnpay", "stripe"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          {data?.invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b py-2"
            >
              <span>
                {invoice.status} ·{" "}
                {formatChatAmount(invoice.amountDue, invoice.currency)}
              </span>
              {invoice.status === "open" ? (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      const result = await api.chatPayInvoice(
                        invoice.id,
                        provider
                      )
                      if (
                        result.checkout?.clientSecret &&
                        result.checkout.publishableKey &&
                        result.payment?.id
                      ) {
                        setCardPayment({
                          invoiceId: invoice.id,
                          paymentId: result.payment.id,
                          clientSecret: result.checkout.clientSecret,
                          publishableKey: result.checkout.publishableKey,
                        })
                      } else if (result.checkout?.url) {
                        const url = new URL(result.checkout.url)
                        if (url.protocol !== "https:")
                          throw new Error("Invalid checkout URL")
                        window.location.assign(url.href)
                      } else
                        throw new Error(
                          "This provider requires a configured hosted checkout. Choose another provider."
                        )
                    })
                  }
                >
                  Pay
                </Button>
              ) : null}
              {data.payments
                .filter((payment) => payment.referenceId === invoice.id)
                .map((payment) => (
                  <Button
                    key={payment.id}
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void act(() =>
                        api.chatReconcileInvoice(invoice.id, payment.id)
                      )
                    }
                  >
                    {payment.status} · Reconcile
                  </Button>
                ))}
            </div>
          ))}
        </CardContent>
      </Card>
      {cardPayment ? (
        <StripePayment
          clientSecret={cardPayment.clientSecret}
          publishableKey={cardPayment.publishableKey}
          onComplete={async () => {
            await api.chatReconcileInvoice(
              cardPayment.invoiceId,
              cardPayment.paymentId
            )
            setCardPayment(null)
            await refresh()
          }}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Entitlements</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.entitlements.map((entry, index) => (
            <p key={entry.featureKey ?? index}>
              {entry.featureKey ?? "Feature"}: {String(entry.value)}
            </p>
          ))}
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 20))}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={
            !data ||
            Math.max(
              data.invoices.length,
              data.subscriptions.length,
              data.payments.length
            ) < 20
          }
          onClick={() => setOffset(offset + 20)}
        >
          Next
        </Button>
      </div>
    </main>
  )
}
