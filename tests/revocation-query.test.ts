import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "@gorth-com/structure/cores/postgres";
import { revocationTable } from "@/database/auth";

const fixture = vi.hoisted(() => ({
  where: vi.fn(),
  limit: vi.fn(),
  deleted: vi.fn(),
  receipt: vi.fn(),
}));
vi.mock("@/lib/auth/config", () => ({ getAuthConfig: vi.fn() }));
vi.mock("@/database", () => ({
  getDatabase: () => ({
    select: () => ({
      from: () => ({
        where: (condition: SQL) => {
          fixture.where(condition);
          return { limit: fixture.limit };
        },
      }),
    }),
    transaction: async (
      operation: (transaction: unknown) => Promise<unknown>,
    ) =>
      operation({
        insert: () => ({
          values: () => ({
            onConflictDoNothing: () => ({ returning: fixture.receipt }),
          }),
        }),
        delete: () => ({ where: fixture.deleted }),
      }),
  }),
}));
import {
  rawEndSsoSessions,
  rawIsSsoSessionRevoked,
} from "@/models/revocation";

const now = Date.parse("2026-10-14T01:00:00.000Z");
const issuedAt = now - 60_000;
const dialect = new PgDialect();
// Creating the lazy client does not connect. Drizzle installs its actual
// transparent timestamp serializer; query compilation never touches a DB.
const client = postgres({ host: "127.0.0.1", port: 1, max: 1 });
drizzle({ client });
afterAll(() => client.end({ timeout: 1 }));
beforeEach(() => {
  vi.resetAllMocks();
  fixture.limit.mockImplementation(async () => {
    const query = dialect.sqlToQuery(fixture.where.mock.calls.at(-1)![0]);
    // Raw Date parameters reach postgres-js without a timestamp encoder and
    // fail its string/buffer serialization before any DB authorization result.
    for (const value of query.params) {
      if (value instanceof Date) Buffer.byteLength(value as never);
    }
    return [];
  });
  fixture.receipt.mockResolvedValue([{ id: "logout-jti" }]);
  fixture.deleted.mockImplementation(async (condition: SQL) => {
    for (const value of dialect.sqlToQuery(condition).params) {
      if (value instanceof Date) Buffer.byteLength(value as never);
    }
  });
});

it("reproduces the raw-SQL Date serialization error from the reported revocation stage", () => {
  const query = dialect.sqlToQuery(
    sql`${revocationTable.expiresAt} > ${new Date(now)}`,
  );
  expect(query.params[0]).toBeInstanceOf(Date);
  const serialized = client.options.serializers[1184]!(query.params[0]);
  expect(serialized).toBeInstanceOf(Date);
  try {
    Buffer.byteLength(serialized as never);
    throw new Error("Expected serialization to fail");
  } catch (error) {
    expect(error).toHaveProperty("code", "ERR_INVALID_ARG_TYPE");
  }
});

it("encodes revocation timestamps while retaining SID, subject and the one-second boundary", async () => {
  expect(
    await rawIsSsoSessionRevoked({
      subject: "sso-sub",
      sid: "sso-sid",
      issuedAt,
      now,
    }),
  ).toBe(false);
  const query = dialect.sqlToQuery(fixture.where.mock.calls[0]![0]);
  expect(query.params).toEqual([
    new Date(now).toISOString(),
    "sso-sid",
    "sso-sub",
    "sso-sub",
    new Date(issuedAt - 1000).toISOString(),
  ]);
  expect(query.sql).toContain('"revocation"."expires_at" >');
  expect(query.sql).toContain('"revocation"."created_at" >=');
  expect(query.sql).toContain('"revocation"."sid" is null');
  expect(query.sql).toContain('"revocation"."subject" is null');
  expect(query.params.some((value) => value instanceof Date)).toBe(false);
});

it("requires subject-wide receipts when no SID is supplied", async () => {
  await rawIsSsoSessionRevoked({ subject: "sso-sub", issuedAt, now });
  const query = dialect.sqlToQuery(fixture.where.mock.calls[0]![0]);
  expect(query.params).toEqual([
    new Date(now).toISOString(),
    "sso-sub",
    new Date(issuedAt - 1000).toISOString(),
  ]);
  expect(query.sql).not.toContain('"revocation"."sid" =');
  expect(query.sql).toContain('"revocation"."sid" is null');
});

it("honors stored revocation and does not treat DB failures as an active session", async () => {
  fixture.limit.mockResolvedValueOnce([{ id: "logout-jti" }]);
  expect(
    await rawIsSsoSessionRevoked({
      subject: "sso-sub",
      sid: "sso-sid",
      issuedAt,
      now,
    }),
  ).toBe(true);
  fixture.limit.mockRejectedValueOnce(new Error("database unavailable"));
  await expect(
    rawIsSsoSessionRevoked({
      subject: "sso-sub",
      sid: "sso-sid",
      issuedAt,
      now,
    }),
  ).rejects.toThrow("database unavailable");
});

it("also encodes the timestamp in subject-wide backchannel session deletion", async () => {
  await rawEndSsoSessions({
    jti: "logout-jti",
    subject: "sso-sub",
    issuedAt,
    revokeUntil: now + 60_000,
    receiptExpiresAt: now + 60_000,
  });
  const query = dialect.sqlToQuery(fixture.deleted.mock.calls[0]![0]);
  expect(query.params).toEqual([
    "sso-sub",
    new Date(issuedAt + 1000).toISOString(),
  ]);
  expect(query.sql).toContain('"session"."created_at" <=');
  expect(query.params.some((value) => value instanceof Date)).toBe(false);
});

it("never deletes a newly-created session when replaying a consumed logout receipt", async () => {
  fixture.receipt.mockResolvedValueOnce([]);
  expect(
    await rawEndSsoSessions({
      jti: "logout-jti",
      subject: "sso-sub",
      sid: "sso-sid",
      issuedAt,
      revokeUntil: now + 60_000,
      receiptExpiresAt: now + 60_000,
    }),
  ).toBe(false);
  expect(fixture.deleted).not.toHaveBeenCalled();
});
