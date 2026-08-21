"use client"

import { Geist, Geist_Mono, Inter } from "next/font/google"

import "@/styles/globals.css"
import { ApplicationProvider } from "@gorth/primitive/providers/application"
import { AuthProvider } from "@/providers/auth"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

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
