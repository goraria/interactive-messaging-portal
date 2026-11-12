export function messageOrder(
  left: { createdAt: string; id: string },
  right: { createdAt: string; id: string }
) {
  return (
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  )
}
export function readChatCursor(value?: string) {
  if (!value) return null
  try {
    const [createdAt, id] = JSON.parse(
      Buffer.from(value, "base64url").toString()
    )
    if (
      typeof createdAt !== "string" ||
      !/^\d{4}-\d\d-\d\dT/.test(createdAt) ||
      !Number.isFinite(Date.parse(createdAt)) ||
      typeof id !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        id
      )
    )
      throw new Error()
    return { createdAt, id }
  } catch {
    throw new Error("invalid_message_cursor")
  }
}
export function writeChatCursor(row: { createdAt: Date | string; id: string }) {
  return Buffer.from(
    JSON.stringify([
      typeof row.createdAt === "string"
        ? row.createdAt
        : row.createdAt.toISOString(),
      row.id,
    ])
  ).toString("base64url")
}
export function canManageMember(actor: string, target: string, next?: string) {
  return (
    actor === "owner" ||
    (actor === "admin" && target === "member" && (!next || next === "member"))
  )
}
