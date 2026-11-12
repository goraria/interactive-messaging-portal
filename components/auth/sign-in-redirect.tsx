"use client"
import { useEffect, useRef, useState } from "react"
import { Button } from "@gorth-io/primitive/custom/button"
import { login } from "@/services/client/auth"

export function SignInRedirect({ returnTo }: { returnTo: string }) {
  const started = useRef(false)
  const [error, setError] = useState(false)
  async function signIn() {
    setError(false)
    try {
      await login(returnTo)
    } catch {
      setError(true)
    }
  }
  useEffect(() => {
    if (started.current) return
    started.current = true
    void signIn()
    // One native OAuth start per mounted sign-in page, including Strict Mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return error ? (
    <Button onClick={() => void signIn()}>Try sign in again</Button>
  ) : (
    <p className="text-sm text-muted-foreground">Opening Gorth SSO…</p>
  )
}
