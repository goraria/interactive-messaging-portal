import { expect, it } from "vitest";
import { measureRequest, withRequestTiming } from "@/utils/server/timing";

it("isolates concurrent request timings and returns no inputs or credentials", async () => {
  const [first, second] = await Promise.all([
    withRequestTiming(() => measureRequest("auth", async () => "secret-a")),
    withRequestTiming(() => measureRequest("chat_db", async () => "secret-b")),
  ]);
  expect(first.result).toBe("secret-a");
  expect(first.header).toMatch(/auth;dur=\d+\.\d/);
  expect(first.header).not.toContain("chat_db");
  expect(second.header).toContain("chat_db;dur=");
  expect(second.header).not.toContain("auth;");
  expect(first.header + second.header).not.toContain("secret");
});
