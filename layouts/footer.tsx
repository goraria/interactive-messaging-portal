"use client";

import { Footer } from "@gorth-com/primitive/layouts/footer";
import Link from "next/link";
import { AppBrand } from "@/components/app-brand";
import { appGlobal } from "@/utils/constant";

export function DashboardFooter() {
  return (
    <Footer
      mode="dashboard"
      nav={{ main: [], secondary: [] }}
      bottom={
        <div className="flex w-full flex-wrap items-center justify-between gap-4 text-sm">
          <Link href="/" aria-label="Home" className="flex items-center gap-2">
            <AppBrand variant="footer" />
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {appGlobal.name}
            </span>
          </Link>
          <span>
            © {new Date().getFullYear()} Gorth, Inc. All rights reserved.
          </span>
          <span className="hidden sm:inline">
            Secure messaging for modern teams.
          </span>
        </div>
      }
    />
  );
}
