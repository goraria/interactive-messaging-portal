"use client"

import { Header } from "@gorth/primitive/layouts/header"
import { Button } from "@gorth/primitive/custom/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@gorth/primitive/default/tooltip"
import { PanelLeft } from "@gorth/primitive/cores/lucide"
import { useSidebar } from "@gorth/primitive/custom/sidebar"
import { useAuth } from "@/hooks/use-auth"
import { useUser } from "@/hooks/use-user"
import { visitor } from "@/lib/utils/constant"

interface DashbarProps {
  onSidebarToggle?: () => void
}

export function Dashbar({ onSidebarToggle }: DashbarProps) {
  const auth = useAuth()
  const { loading, authenticated, login, register, logout } = auth
  const { user } = useUser()
  const { toggleSidebar } = useSidebar()
  const handleSidebarToggle = onSidebarToggle ?? toggleSidebar

  return (
    <Header
      mode="dashboard"
      user={user ?? visitor}
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
        </>
      }
    />
  )
}
