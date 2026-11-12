import { expect, it } from "vitest"
import type { Response } from "@/lib/http"
import { isAdmin } from "@/utils/controller"
import { updateUserSchema } from "@/schemas/chat"

it("grants local administration only from the current application's database role", () => {
  const response = (auth?: unknown) =>
    ({ locals: { auth } }) as unknown as Response
  expect(isAdmin(response())).toBe(false)
  expect(
    isAdmin(
      response({
        app: { role: "admin", roles: ["admin"], permissions: ["admin"] },
      })
    )
  ).toBe(false)
  expect(isAdmin(response({ localRole: "user", app: { role: "admin" } }))).toBe(
    false
  )
  expect(isAdmin(response({ localRole: "admin", app: { role: "user" } }))).toBe(
    true
  )
})

it("profile updates cannot rebind the SSO subject or change local authorization", () => {
  const input = updateUserSchema.parse({
    name: "Updated name",
    externalUserId: "other-sso-subject",
    role: "admin",
    status: "active",
    bannedAt: null,
    deletedAt: null,
  })
  expect(input.name).toBe("Updated name")
  for (const field of [
    "externalUserId",
    "role",
    "status",
    "bannedAt",
    "deletedAt",
  ])
    expect(input).not.toHaveProperty(field)
})
