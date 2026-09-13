"use client"

import axios from "@gorth/structure/cores/axios"

let refreshRequest: Promise<boolean> | null = null

export function refreshAuthentication() {
  if (refreshRequest) return refreshRequest

  refreshRequest = axios
    .request({
      url: "/auth/me",
      method: "GET",
      withCredentials: true,
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-store",
      },
    })
    .then(
      (response) =>
        response.status >= 200 &&
        response.status < 300 &&
        response.status !== 204
    )
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
