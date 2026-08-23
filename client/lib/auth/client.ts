"use client"

let refreshRequest: Promise<boolean> | null = null

export function refreshAuthentication() {
  if (refreshRequest) return refreshRequest

  refreshRequest = fetch("/auth/me", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  })
    .then((response) => response.ok && response.status !== 204)
    .catch(() => false)
    .finally(() => {
      refreshRequest = null
    })

  return refreshRequest
}

export async function withAuthRetry<T>(
  request: () => Promise<T>,
  getStatus: (error: unknown) => number | undefined,
  enabled = true
) {
  try {
    return await request()
  } catch (error) {
    if (!enabled || getStatus(error) !== 401) throw error

    const refreshed = await refreshAuthentication()
    if (!refreshed) throw error

    return request()
  }
}
