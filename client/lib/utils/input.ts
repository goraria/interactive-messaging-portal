import { toast } from "@gorth/primitive/cores/sonner"

export function parseJsonInput(
  value: string,
  options: { label: string; objectOnly: true },
): Record<string, unknown> | null | undefined
export function parseJsonInput(
  value: string,
  options: { label: string; objectOnly?: false },
): unknown | null | undefined
export function parseJsonInput(
  value: string,
  { label, objectOnly = false }: { label: string; objectOnly?: boolean },
) {
  const text = value.trim()
  if (!text) return undefined

  try {
    const parsed = JSON.parse(text)
    if (objectOnly && (!parsed || typeof parsed !== "object" || Array.isArray(parsed))) {
      toast.error(label + " must be a valid JSON object")
      return null
    }
    return parsed
  } catch {
    toast.error(label + " is not valid JSON")
    return null
  }
}
