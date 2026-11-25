"use client"
import { caller } from "@/utils/caller"
export interface ChatPlan {
  id: string
  name: string
  plans: {
    id: string
    name: string
    prices: {
      id: string
      currency: string
      unitAmount: number
      interval: string
    }[]
  }[]
}
export interface ChatInvoice {
  id: string
  status: string
  currency: string
  amountDue: number
}
export interface ChatSubscription {
  id: string
  status: string
  cancelAtPeriodEnd: boolean
}
export interface ChatPayment {
  id: string
  status: string
  amount: number
  currency: string
  referenceId: string
}
export interface ChatCheckout {
  checkout?: { url?: string; clientSecret?: string; publishableKey?: string }
  payment?: { id: string }
}
export async function chatBillingSnapshot(offset = 0) {
  const [catalog, subscriptions, invoices, payments, entitlements] =
    await Promise.all([
      caller<ChatPlan[]>({
        url: "/external/billing/catalog",
        baseURL: null,
        params: { application: "chat", limit: 50, offset: 0 },
      }),
      caller<ChatSubscription[]>({
        url: "/external/billing/subscription",
        baseURL: null,
        params: { limit: 20, offset },
      }),
      caller<ChatInvoice[]>({
        url: "/external/billing/invoice",
        baseURL: null,
        params: { limit: 20, offset },
      }),
      caller<ChatPayment[]>({
        url: "/external/payment",
        baseURL: null,
        params: { limit: 20, offset, referenceType: "invoice" },
      }),
      caller<{ featureKey?: string; value: unknown }[]>({
        url: "/external/billing/entitlement",
        baseURL: null,
        params: { application: "chat" },
      }),
    ])
  return { catalog, subscriptions, invoices, payments, entitlements }
}
export async function chatSubscribe(priceId: string) {
  return caller({
    url: "/external/billing/subscription",
    baseURL: null,
    method: "POST",
    body: { priceId, quantity: 1 },
  })
}
export async function chatCancelSubscription(id: string, resume: boolean) {
  return caller({
    url: `/external/billing/subscription/${id}/${resume ? "resume" : "cancel"}`,
    baseURL: null,
    method: "POST",
    body: { atPeriodEnd: true },
  })
}
export async function chatPayInvoice(id: string, provider: string) {
  return caller<ChatCheckout>({
    url: `/external/billing/invoice/${id}/payment`,
    baseURL: null,
    method: "POST",
    headers: { "Idempotency-Key": `chat-invoice:${id}:${provider}` },
    body: { provider, returnUrl: window.location.origin + "/billing" },
    unwrapData: false,
  })
}
export async function chatReconcileInvoice(id: string, paymentId: string) {
  return caller({
    url: `/external/billing/invoice/${id}/reconcile`,
    baseURL: null,
    method: "POST",
    body: { paymentId },
  })
}
