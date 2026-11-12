import "server-only"

import { fetcher, toWebResponse, type FetcherOptions } from "@/utils/fetcher"
export async function forwardRouteRequest(options: {
  url: URL
  method: string
  headers: Headers
  body?: ArrayBuffer
}) {
  const response = await fetcher<ArrayBuffer, ArrayBuffer | undefined>({
    url: options.url,
    method: options.method as FetcherOptions["method"],
    headers: Object.fromEntries(options.headers),
    body: options.body,
    redirect: "manual",
    cache: "no-store",
    responseType: "arraybuffer",
    validateStatus: () => true,
  })

  const result = toWebResponse(response)
  result.headers.set("Cache-Control", "no-store")
  return result
}
