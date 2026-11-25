import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ definitions: [] as unknown[] }));
vi.mock("@/utils/caller", () => ({
  defineQuery: (options: unknown) => {
    fixture.definitions.push(options);
    return options;
  },
  defineMutation: (options: unknown) => options,
  createQueryService: () => vi.fn(),
  createMutationService: () => vi.fn(),
}));
import "@/queries/notification";

it("stops notification polling after an error, without replacing the result with a zero count", () => {
  const definition = fixture.definitions[1] as {
    queryOptions: (input: { enabled: boolean }) => {
      refetchInterval: (query: { state: { error: unknown } }) => number | false;
      retry: boolean;
    };
  };
  const options = definition.queryOptions({ enabled: true });
  expect(options.retry).toBe(false);
  expect(options.refetchInterval({ state: { error: null } })).toBe(30_000);
  expect(
    options.refetchInterval({ state: { error: new Error("offline") } }),
  ).toBe(false);
  expect(
    definition
      .queryOptions({ enabled: false })
      .refetchInterval({ state: { error: null } }),
  ).toBe(false);
});

it("uses Primitive's avatar-only trigger in the narrow sidebar footer and offers conversation recovery", () => {
  const source = readFileSync(
    new URL("../components/conversation/chat-sidebar.tsx", import.meta.url),
    "utf8",
  );
  const footer = source.slice(
    source.indexOf("<SidebarFooter"),
    source.indexOf("</SidebarFooter>"),
  );
  expect(footer).toContain('className="items-center p-1.5"');
  expect(footer).toContain("<NavUser");
  expect(footer).toContain('type="navbar"');
  expect(footer).not.toContain('type="sidebar"');
  expect(source).toContain('from "@gorth-com/primitive/dashboard/nav-user"');
  expect(source).toContain("onClick={onRetryConversations}");
});
