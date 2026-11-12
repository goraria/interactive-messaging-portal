import type { MessengerMessage } from "@/schemas/client/messenger"
export function mergeChatMessages(
  current: MessengerMessage[],
  incoming: MessengerMessage[]
) {
  const rows = new Map(current.map((row) => [row.id, row]))
  for (const row of incoming) {
    const old = rows.get(row.id)
    if (
      !old ||
      row.version > old.version ||
      (row.version === old.version &&
        BigInt(row.syncVersion) >= BigInt(old.syncVersion))
    )
      rows.set(row.id, row)
  }
  return [...rows.values()].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  )
}
