"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Button } from "@gorth/primitive/custom/button"
import { SidebarProvider } from "@gorth/primitive/custom/sidebar"
import { Navbar } from "@gorth/primitive/layouts/navbar"
import { useAuth } from "@/hooks/use-auth"
import { sharedNavbar, visitor } from "@/lib/utils/constant"
import { toNavigationUser } from "@/lib/utils/formatter"

export default function SharedLayout({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const user = auth.account ? toNavigationUser(auth.account) : visitor

  return (
    <SidebarProvider>
      <div className="bg-background text-foreground flex min-h-svh flex-1 flex-col">
        <Navbar
          auth={auth}
          user={user}
          nav={{
            main: sharedNavbar.navDropdown,
            secondary: sharedNavbar.navSignal,
            // navigation: sharedNavbar.navDropdown,
          }}
          bottom={
            <Button
              nativeButton={false}
              render={<Link href="/" />}
              variant="ghost"
              className="text-lg font-bold"
            >
              Gorth
            </Button>
          }
        />

        <main className="flex flex-1 flex-col">
          <div className="container mx-auto flex-1 p-6">{children}</div>
        </main>

        <footer className="border-t">
          <div className="container mx-auto px-6 py-10">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
              <div className="max-w-sm">
                <Link href="/" className="text-foreground text-lg font-bold">
                  Gorth
                </Link>
                <p className="text-muted-foreground mt-3 text-sm leading-6">
                  One secure identity for every application your team uses.
                  Simple access, centralized control, and fewer interruptions.
                </p>
              </div>

              <div>
                <p className="text-foreground text-sm font-medium">Product</p>
                <div className="text-muted-foreground mt-3 flex flex-col gap-2 text-sm">
                  <Link href="/#how-it-works" className="hover:text-foreground">
                    How it works
                  </Link>
                  <Link href="/#security" className="hover:text-foreground">
                    Security
                  </Link>
                  <Link href="/#pricing" className="hover:text-foreground">
                    Get started
                  </Link>
                </div>
              </div>

              <div>
                <p className="text-foreground text-sm font-medium">Account</p>
                <div className="text-muted-foreground mt-3 flex flex-col gap-2 text-sm">
                  <Link href="/auth/sign-in" className="hover:text-foreground">
                    Sign in
                  </Link>
                  <Link href="/auth/sign-up" className="hover:text-foreground">
                    Create account
                  </Link>
                  <Link href="/demo" className="hover:text-foreground">
                    API demo
                  </Link>
                </div>
              </div>

              <div>
                <p className="text-foreground text-sm font-medium">Company</p>
                <div className="text-muted-foreground mt-3 flex flex-col gap-2 text-sm">
                  <a
                    href="mailto:hello@gorth.app"
                    className="hover:text-foreground"
                  >
                    Contact
                  </a>
                  <Link href="/#security" className="hover:text-foreground">
                    Privacy
                  </Link>
                  <Link href="/#security" className="hover:text-foreground">
                    Terms
                  </Link>
                </div>
              </div>
            </div>

            <div className="text-muted-foreground mt-10 flex flex-col gap-2 border-t pt-5 text-xs sm:flex-row sm:items-center sm:justify-between">
              <span>© 2026 Gorth, Inc. All rights reserved.</span>
              <span>Secure access, built for modern teams.</span>
            </div>
          </div>
        </footer>
      </div>
    </SidebarProvider>
  )
}
