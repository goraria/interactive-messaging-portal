"use client";

import { Header } from "@gorth-com/primitive/layouts/header";
import Link from "next/link";
import { AppBrand } from "@/components/app-brand";
import { Button } from "@gorth-com/primitive/custom/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@gorth-com/primitive/default/tooltip";
import { PanelLeft } from "@gorth-com/primitive/cores/lucide";
import { useSidebar } from "@gorth-com/primitive/custom/sidebar";
import { ModeSwitcher } from "@gorth-com/primitive/element/mode-toggle";
import { Customizer } from "@gorth-com/primitive/element/customizer";
import { NavUser } from "@gorth-com/primitive/modules/dashboard";
import { NotificationMenu } from "@/components/notification/notification-menu";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import { visitor } from "@/utils/constant";

interface DashbarProps {
  onSidebarToggle?: () => void;
}

export function Dashbar({ onSidebarToggle }: DashbarProps) {
  const auth = useAuth();
  const { loading, authenticated, login, register, logout } = auth;
  const { user } = useUser();
  const { toggleSidebar } = useSidebar();
  const handleSidebarToggle = onSidebarToggle ?? toggleSidebar;

  return (
    <Header
      mode="dashboard"
      user={user ?? visitor}
      auth={{ loading, authenticated, login, register, logout }}
      nav={{ main: [], secondary: [] }}
      right={
        <>
          <NotificationMenu enabled={authenticated} />
          <ModeSwitcher />
          <Customizer />
          <NavUser
            user={user ?? visitor}
            type="navbar"
            side="bottom"
            align="end"
            size="icon"
            auth={{ loading, authenticated, login, register, logout }}
            nav={{ main: [], secondary: [] }}
          />
        </>
      }
      left={
        <>
          <Link href="/" aria-label="Gorth Chat home">
            <AppBrand />
          </Link>
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
  );
}
