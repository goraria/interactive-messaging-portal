// "use client"

import { Geist, Geist_Mono, Inter } from "next/font/google"
import type { Metadata } from "next"
import "@/styles/globals.css"
import { ApplicationProvider } from "@gorth/primitive/providers/application"
import { AuthProvider } from "@/providers/auth"
import { cn } from "@gorth/primitive/lib/utils"
import { appGlobal } from "@/lib/utils/constant";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: {
    default: appGlobal.name,
    template: `%s | ${appGlobal.name}`,
  },
  description: appGlobal.description,
  icons: {
    icon: "/assets/icon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body>
        <ApplicationProvider>
          <AuthProvider>{children}</AuthProvider>
        </ApplicationProvider>
      </body>
    </html>
  )
}
