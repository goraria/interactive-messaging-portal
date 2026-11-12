// Read from the raw header: framework cookie maps can collapse duplicates.
export function getUniqueCookie(header: string | null, name: string) {
  const matches = (header ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(name + "="))
  if (matches.length !== 1) return null
  try {
    return decodeURIComponent(matches[0]!.slice(name.length + 1))
  } catch {
    return null
  }
}
