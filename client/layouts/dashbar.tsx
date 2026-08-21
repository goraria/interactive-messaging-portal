"use client"

import React from "react"
import { Dashbar as Container } from "@gorth/primitive/layouts/dashbar"
import { Button } from "@gorth/primitive/custom/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@gorth/primitive/default/tooltip"
import { ModeSwitcher } from "@gorth/primitive/element/mode-toggle"
import { PanelLeft } from "@gorth/primitive/cores/lucide"
import { useSidebar } from "@gorth/primitive/custom/sidebar"
import { useAuth } from "@/hooks/use-auth"
import { Customizer } from "@gorth/primitive/element/customizer"
import { visitor } from "@/lib/utils/constant"
import { toNavigationUser } from "@/lib/utils/formatter"

interface DashbarProps {
  onSidebarToggle?: () => void
}

export function Dashbar({ onSidebarToggle }: DashbarProps) {
  const auth = useAuth()
  const { account, loading, authenticated, login, register, logout } = auth
  const { toggleSidebar } = useSidebar()
  const handleSidebarToggle = onSidebarToggle ?? toggleSidebar

  return (
    <Container
      user={account ? toNavigationUser(account) : visitor}
      auth={{ loading, authenticated, login, register, logout }}
      nav={{ main: [], secondary: [] }}
      left={
        <>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Toggle message sidebar"
                  onClick={handleSidebarToggle}
                >
                  <PanelLeft />
                </Button>
              }
            />
            <TooltipContent side="left">
              <p>Toggle message sidebar</p>
            </TooltipContent>
          </Tooltip>
          {/*<Separator*/}
          {/*  orientation="vertical"*/}
          {/*  className="mr-2 data-[orientation=vertical]:h-4"*/}
          {/*/>*/}

          {/*<div className="mr-4 flex items-center">*/}
          {/*  <Link href="/" className="flex items-center space-x-2">*/}
          {/*    <Image*/}
          {/*      className="w-9 h-9"*/}
          {/*      src="/logo/icon.png"*/}
          {/*      alt={""}*/}
          {/*      width={36}*/}
          {/*      height={36}*/}
          {/*    />*/}
          {/*    <span className="text-lg font-bold hidden md:inline-block">{"Japtor"}</span>*/}
          {/*  </Link>*/}
          {/*</div>*/}
        </>
      }
      right={
        <>
          <ModeSwitcher />
          <Customizer />
        </>
      }
    />
  )
}
