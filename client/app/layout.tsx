import { Geist_Mono, Inter } from "next/font/google"
import type { Metadata } from "next"

import "@/styles/globals.css"
import { ApplicationLayout } from "@gorth/primitive/layouts/application"

import { appGlobal } from "@/lib/utils/constant"
import { AuthProvider } from "@/providers/auth"

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
}
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ApplicationLayout
      className={`font-sans antialiased ${fontMono.variable} ${inter.variable}`}
    >
      <AuthProvider>{children}</AuthProvider>
    </ApplicationLayout>
  )
}
