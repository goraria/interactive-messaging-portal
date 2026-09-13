"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Check,
  ChevronRight,
  Dot,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "@gorth/primitive/cores/lucide"
import { Avatar, AvatarFallback } from "@gorth/primitive/custom/avatar"
import { Badge } from "@gorth/primitive/custom/badge"
import { Button } from "@gorth/primitive/custom/button"
import { Card } from "@gorth/primitive/default/card"
import { LoadingScreen } from "@/features/shared/loading"
import { useAuth } from "@/hooks/use-auth"

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

const highlights = [
  "Realtime",
  "Focused",
  "Private",
  "Encrypted",
  "Cross-device",
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
    return <LoadingScreen />
  }

  return (
    <div className="w-full overflow-hidden">
      <Card
        className="-mx-6 -mt-6 gap-0 rounded-none bg-transparent py-0 shadow-none ring-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 36% 36% at center, color-mix(in oklab, var(--primary) 55%, transparent) 0%, color-mix(in oklab, var(--primary) 22%, transparent) 45%, transparent 100%)",
        }}
      >
        <section id="top" className="relative px-6 py-12">
          <div className="relative grid items-center gap-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-16 xl:gap-20">
            <div>
              <Badge
                variant="outline"
                className="mb-6 inline-flex items-center gap-2 rounded-full border font-mono backdrop-blur-sm"
              >
                <Dot className="bg-accent size-2 rounded-full" />
                Simple. Fast. Realtime.
              </Badge>

              <h1 className="text-foreground max-w-3xl text-5xl font-semibold tracking-[-0.065em] text-balance sm:text-6xl lg:text-7xl lg:leading-[.98] xl:text-[5.25rem]">
                Conversations that stay out of{" "}
                <span className="text-primary">your way.</span>
              </h1>

              <p className="text-muted-foreground mt-8 max-w-xl text-lg leading-8 text-pretty">
                A focused place to talk, share, and keep in touch with the
                people who matter.
              </p>

              <div id="start" className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Button onClick={() => login("/chat")}>
                  Sign in to continue
                  <ArrowRight data-icon="inline-end" />
                </Button>
                <Button variant="outline" onClick={() => register("/chat")}>
                  Create an account
                  <ChevronRight data-icon="inline-end" />
                </Button>
              </div>

              <div className="text-muted-foreground mt-7 flex items-center gap-2 text-sm">
                <Check className="text-accent" /> Private by default
                <span className="text-border">•</span> Ready in seconds
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md">
              <div
                className="bg-primary/10 absolute -inset-2 rounded-4xl blur-2xl"
                aria-hidden="true"
              />
              <Card className="border-border bg-card shadow-primary/10 text-foreground relative gap-0 rounded-3xl border p-3 shadow-2xl ring-0">
                <div className="border-border bg-background rounded-xl border p-6 sm:p-8">
                  <div className="border-border flex items-center gap-3 border-b pb-5">
                    <Avatar size="lg">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        JC
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">Japtor Community</p>
                      <p className="text-muted-foreground text-xs">
                        Realtime connected
                      </p>
                    </div>
                    <span className="bg-accent size-2 rounded-full" />
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="flex items-end gap-2.5">
                      <Avatar>
                        <AvatarFallback>JD</AvatarFallback>
                      </Avatar>
                      <div className="bg-muted max-w-[78%] rounded-md px-3 py-2 text-sm">
                        Ready to keep the conversation moving?
                      </div>
                    </div>
                    <div className="flex items-end justify-end gap-2.5">
                      <div className="bg-primary text-primary-foreground max-w-[78%] rounded-md px-3 py-2 text-sm">
                        Always. No refresh required.
                      </div>
                      <Avatar>
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          YOU
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>

                  <Button
                    className="mt-6 w-full"
                    onClick={() => login("/chat")}
                  >
                    Open your inbox <ArrowRight data-icon="inline-end" />
                  </Button>
                </div>
              </Card>

              <div className="border-border bg-card text-foreground absolute -bottom-5 -left-8 hidden rounded-xl border px-4 py-3 shadow-lg sm:block">
                <p className="text-muted-foreground font-mono text-[10px]">
                  CONVERSATIONS
                </p>
                <p className="mt-1 text-sm font-medium">Always in sync</p>
              </div>
            </div>
          </div>
        </section>
      </Card>

      <Card
        id="how-it-works"
        className="border-border rounded-2xl border p-6 ring-0"
      >
        <div>
          <p className="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">
            Built for conversation
          </p>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <article key={title} className="border-border border-l-2 pl-5">
                <Icon className="text-accent size-5" />
                <h2 className="mt-5 text-lg font-medium tracking-tight">
                  {title}
                </h2>
                <p className="text-muted-foreground mt-3 max-w-sm text-sm leading-6">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </Card>

      <section id="security" className="py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">
              Quietly connected
            </p>
            <h2 className="mt-5 max-w-lg text-4xl font-semibold tracking-[-0.05em] md:text-5xl">
              Keep every conversation moving.
            </h2>
          </div>
          <div>
            <p className="text-muted-foreground max-w-xl text-lg leading-8">
              Find people, continue discussions from one inbox, and stay in
              touch without letting the app get in your way.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {highlights.map((highlight) => (
                <Badge key={highlight}>{highlight}</Badge>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Card
        id="pricing"
        className="bg-primary text-primary-foreground border-primary-foreground/20 gap-0 rounded-2xl border p-6 ring-0"
      >
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div>
            <p className="text-primary-foreground/60 font-mono text-xs tracking-[0.2em] uppercase">
              Ready when you are
            </p>
            <h2 className="mt-5 max-w-xl text-4xl font-semibold tracking-[-0.05em] md:text-5xl">
              Start talking without the noise.
            </h2>
          </div>
          <Button variant="secondary" onClick={() => register("/chat")}>
            Create an account
            <Sparkles data-icon="inline-end" />
          </Button>
        </div>
      </Card>
    </div>
  )
}
