"use client"
export interface PaymentElement {
  mount(target: HTMLElement): void
  destroy(): void
}
export interface PaymentElements {
  create(kind: "payment"): PaymentElement
}
export interface StripePaymentClient {
  elements(input: { clientSecret: string }): PaymentElements
  confirmPayment(input: {
    elements: PaymentElements
    confirmParams: { return_url: string }
    redirect: "if_required"
  }): Promise<{
    error?: { message?: string }
    paymentIntent?: { status: string }
  }>
}
type StripeFactory = (publishableKey: string) => StripePaymentClient
let loading: Promise<StripeFactory> | undefined
export function loadStripePayment() {
  const global = window as Window & { Stripe?: StripeFactory }
  if (global.Stripe) return Promise.resolve(global.Stripe)
  if (loading) return loading
  loading = new Promise<StripeFactory>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://js.stripe.com/v3/"
    script.async = true
    const timer = window.setTimeout(() => {
      loading = undefined
      reject(new Error("Payment provider timed out"))
    }, 15000)
    script.onload = () => {
      clearTimeout(timer)
      if (global.Stripe) resolve(global.Stripe)
      else {
        loading = undefined
        reject(new Error("Payment provider failed to initialize"))
      }
    }
    script.onerror = () => {
      clearTimeout(timer)
      loading = undefined
      reject(new Error("Payment provider is unavailable"))
    }
    document.head.appendChild(script)
  })
  return loading
}
