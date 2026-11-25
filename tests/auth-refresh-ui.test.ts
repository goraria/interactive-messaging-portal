import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  user: {
    id: "local-id",
    externalUserId: "sso-sub",
    name: "User",
    email: "user@example.test",
    username: null,
    image: null,
  },
  state: {
    data: null as unknown,
    isPending: false,
    error: null,
    refetch: vi.fn(),
  },
}));
vi.mock("@/lib/auth/client", () => ({
  authClient: { useSession: () => fixture.state },
}));
vi.mock("@/lib/auth/client/retry", () => ({ resetCallerAuthentication: vi.fn() }));
vi.mock("@gorth-com/primitive/cores/tanstack/query", () => ({
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));
vi.mock("@/utils/client/formatter", () => ({
  resolveInternalPath: (path: string) => path,
  formatAuthUser: (user: typeof fixture.user) => ({
    ...user,
    id: user.externalUserId,
  }),
}));
import { useAuthAccount } from "@/queries/auth";
function Identity() {
  const auth = useAuthAccount();
  return createElement(
    "div",
    null,
    auth.loading
      ? "full-page-loading"
      : auth.account
        ? "preserved-draft:" + auth.account.id
        : "anonymous",
  );
}
beforeEach(() => {
  fixture.state.data = { user: fixture.user };
  fixture.state.isPending = false;
});
it("keeps the mounted UI and SSO-sub identity during native background reads", () => {
  const initial = renderToStaticMarkup(createElement(Identity));
  fixture.state.isPending = true;
  expect(renderToStaticMarkup(createElement(Identity))).toBe(initial);
  expect(initial).toContain("sso-sub");
});
it("only displays loading before the first native session resolves", () => {
  fixture.state.data = null;
  fixture.state.isPending = true;
  expect(renderToStaticMarkup(createElement(Identity))).toContain(
    "full-page-loading",
  );
});
it("does not resurrect a signed-out account from a second query cache", () => {
  fixture.state.data = null;
  expect(renderToStaticMarkup(createElement(Identity))).toContain("anonymous");
});
