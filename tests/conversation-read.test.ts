import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const fixture = vi.hoisted(() => ({ rows: vi.fn(), access: vi.fn() }));
vi.mock("@/database", () => ({ getDatabase: () => ({}) }));
vi.mock("@/models/index", () => ({
  rawChatRows: fixture.rows,
  rawCheckConversationAccess: fixture.access,
  rawAppendChatEvent: vi.fn(),
  rawRequireChatManager: vi.fn(),
}));
vi.mock("@/utils/formatter", () => ({
  formatChatConversation: (row: unknown) => row,
}));
import { rawGetChatConversation } from "@/models/conversation";

beforeEach(() => vi.resetAllMocks());
it("reads detail in one round trip scoped to the active member and exact conversation", async () => {
  fixture.rows.mockResolvedValue([{ id: "conversation-a" }]);
  await expect(
    rawGetChatConversation("conversation-a", "viewer-a"),
  ).resolves.toEqual({ id: "conversation-a" });
  const query = new PgDialect().sqlToQuery(fixture.rows.mock.calls[0]![0]);
  expect(query.sql).toContain("cm.left_at IS NULL");
  expect(query.sql).toContain("cm.user_id=");
  expect(query.params).toContain("viewer-a");
  expect(query.params).toContain("conversation-a");
  expect(fixture.rows).toHaveBeenCalledOnce();
  expect(fixture.access).not.toHaveBeenCalled();
});
it.each([403, 404])(
  "preserves access denial %i when the scoped read returns nothing",
  async (statusCode) => {
    fixture.rows.mockResolvedValue([]);
    fixture.access.mockRejectedValue({ statusCode });
    await expect(
      rawGetChatConversation("conversation-a", "outsider"),
    ).rejects.toEqual({ statusCode });
    expect(fixture.access).toHaveBeenCalledWith(
      {},
      "conversation-a",
      "outsider",
    );
  },
);
