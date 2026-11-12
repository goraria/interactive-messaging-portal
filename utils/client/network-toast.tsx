"use client"

import { toast } from "@gorth-io/primitive/custom/toast"
import { RotateCw } from "@gorth-io/primitive/cores/lucide"

export function showNetworkErrorToast() {
  return toast.add({
    id: "chat-network-error",
    type: "error",
    priority: "high",
    title: <span className="text-destructive">Network error</span>,
    description: "Check your connection and reload to try again.",
    actionProps: {
      children: <RotateCw className="size-4" aria-hidden="true" />,
      "aria-label": "Reload chat",
      className: "size-9 p-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive",
      onClick: () => window.location.reload(),
    },
  })
}
