"use client"

import { useEffect } from "react"
import { isNetworkError } from "@/utils/network-error"
import { showNetworkErrorToast } from "@/utils/client/network-toast"

export function useNetworkErrorToast(error: unknown) {
  const networkError = isNetworkError(error)
  useEffect(() => {
    if (networkError) showNetworkErrorToast()
  }, [networkError])
  return networkError
}
