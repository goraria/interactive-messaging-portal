"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@gorth/primitive/custom/button"
import {
  MessageCircle,
  ShieldCheck,
  Users,
} from "@gorth/primitive/cores/lucide"
import { useAuth } from "@/hooks/use-auth"
import { Spinner } from "@gorth/primitive/pattern/spinner"

const features = [
  {
    icon: MessageCircle,
    title: "Realtime messaging",
    description: "Keep every conversation moving without refreshing the page.",
  },
  {
    icon: Users,
    title: "Focused conversations",
    description: "Find people and continue your discussions from one inbox.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    description:
      "Your account and conversations stay protected behind sign-in.",
  },
]

export default function LandingPage() {
  const router = useRouter()
  const { authenticated, loading, login, register } = useAuth()

  useEffect(() => {
    if (!loading && authenticated) {
      router.replace("/chat")
    }
  }, [authenticated, loading, router])

  if (loading || authenticated) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner variant="infinite" size={32} />
      </main>
    )
  }

  return (
    <main className="bg-background text-foreground flex min-h-svh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2 font-semibold">
          <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-md">
            <MessageCircle className="size-4" />
          </span>
          Gorth Chat
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => login("/chat")}>
            Sign in
          </Button>
          <Button onClick={() => register("/chat")}>Create account</Button>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-14 px-6 py-16">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <p className="text-primary text-sm font-medium">
            Simple. Fast. Realtime.
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
            Conversations that stay out of your way.
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-base leading-7 sm:text-lg">
            A focused place to talk, share, and keep in touch with the people
            who matter.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => login("/chat")}>Sign in to continue</Button>
            <Button variant="outline" onClick={() => register("/chat")}>
              Create an account
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="bg-card space-y-3 rounded-md border p-6"
            >
              <span className="bg-muted flex size-9 items-center justify-center rounded-md">
                <Icon className="size-4" />
              </span>
              <h2 className="font-medium">{title}</h2>
              <p className="text-muted-foreground text-sm leading-6">
                {description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
