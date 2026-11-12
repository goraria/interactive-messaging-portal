"use client"

import { Footer } from "@gorth/primitive/layouts/footer"

export function DashboardFooter() {
  return (
    <Footer
      mode="dashboard"
      nav={{ main: [], secondary: [] }}
      bottom={
        <div className="flex w-full items-center justify-between gap-4 text-sm">
          <span>
            © {new Date().getFullYear()} Gorth, Inc. All rights reserved.
          </span>
          <span className="hidden sm:inline">
            Secure messaging for modern teams.
          </span>
        </div>
      }
    />
  )
}
