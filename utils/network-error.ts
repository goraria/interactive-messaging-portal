export function isNetworkError(error: unknown): boolean {
  if (!error) return false
  const details = typeof error === "object"
    ? error as { message?: unknown; code?: unknown; response?: unknown }
    : null
  // HTTP authorization/validation failures keep their existing presentation.
  if (details?.response) return false
  if (["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT"].includes(String(details?.code)))
    return true
  const message = typeof error === "string" ? error : details?.message
  return typeof message === "string" &&
    /network\s*(?:error|request failed|connection lost)|failed to fetch|fetch failed|load failed|internet.*disconnected/i.test(message)
}
