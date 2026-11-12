"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { SidebarProvider } from "@gorth-io/primitive/custom/sidebar"
import { Header } from "@gorth-io/primitive/layouts/header"
import { Footer } from "@gorth-io/primitive/layouts/footer"
import { Building2, MessageCircle, Users } from "@gorth-io/primitive/cores/lucide"
import { AppBrand } from "@/components/app-brand"
import { useAuth } from "@/hooks/use-auth"
import { useUser } from "@/hooks/use-user"
import { appGlobal, sharedNavbar, visitor } from "@/utils/constant"

const footerNavigation = [
  {
    title: "Product",
    icon: MessageCircle,
    url: "#",
    items: [
      { title: "How it works", url: "/#how-it-works" },
      { title: "Security", url: "/#security" },
      { title: "Get started", url: "/#pricing" },
    ],
  },
  {
    title: "Account",
    icon: Users,
    url: "#",
    items: [
      { title: "Sign in", url: "/auth/sign-in" },
      { title: "Create account", url: "/auth/sign-up" },
      { title: "API demo", url: "/demo" },
    ],
  },
  {
    title: "Company",
    icon: Building2,
    url: "#",
    items: [
      { title: "Contact", url: "mailto:hello@gorth.app" },
      { title: "Privacy", url: "/privacy" },
      { title: "Terms", url: "/#security" },
    ],
  },
]

export default function SharedLayout({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const { user } = useUser()

  return (
    <SidebarProvider>
      <div className="bg-background text-foreground flex min-h-svh flex-1 flex-col">
        <Header
          auth={auth}
          user={user ?? visitor}
          nav={{
            main: sharedNavbar.navDropdown,
            secondary: sharedNavbar.navSignal,
            navigation: sharedNavbar.navSecondary,
          }}
          bottom={
            <Link
              href="/"
              aria-label="Gorth Chat home"
              className="block size-9 shrink-0"
            >
              <AppBrand />
            </Link>
          }
        />

        <main className="flex flex-1 flex-col">
          <div className="container mx-auto flex-1 p-6">{children}</div>
        </main>

        <Footer
          nav={{ main: footerNavigation, secondary: [] }}
          top={
            <Link
              href="/"
              aria-label="Gorth Chat home"
              className="flex items-center gap-3"
            >
              <AppBrand variant="footer" />
              <span className="text-foreground truncate text-2xl font-bold tracking-tight">
                {appGlobal.name}
              </span>
            </Link>
          }
          middle={
            <p className="max-w-xs leading-6">
              A focused place to talk, share, and keep in touch with the people
              who matter.
            </p>
          }
          bottom={
            <div className="flex w-full flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
              <span>
                © {new Date().getFullYear()} Gorth, Inc. All rights reserved.
              </span>
              <span>Secure messaging for modern teams.</span>
            </div>
          }
        />
      </div>
    </SidebarProvider>
  )
}
