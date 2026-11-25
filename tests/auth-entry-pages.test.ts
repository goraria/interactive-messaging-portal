import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  effects: [] as Array<() => void>,
  login: vi.fn(),
  register: vi.fn(),
  replace: vi.fn(),
  failed: vi.fn(),
  loading: false,
  authenticated: false,
  signingIn: false,
  error: null as Error | null,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => void) => fixture.effects.push(effect),
  useState: () => [false, fixture.failed],
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: fixture.replace }),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => fixture }));
vi.mock("@gorth-com/primitive/pages/internal-server-error", () => ({
  default: () => createElement("div", { role: "alert" }, "500"),
}));
vi.mock("@gorth-com/primitive/pattern/spinner", () => ({
  Spinner: ({ variant }: { variant: string }) =>
    createElement("span", { "data-spinner": variant }),
}));
import SignIn from "@/app/(auth)/auth/sign-in/page";
import SignUp from "@/app/(auth)/auth/sign-up/page";

beforeEach(() => {
  vi.clearAllMocks();
  fixture.effects = [];
  fixture.loading = false;
  fixture.authenticated = false;
  fixture.signingIn = false;
  fixture.error = null;
  fixture.login.mockResolvedValue(undefined);
  fixture.register.mockResolvedValue(undefined);
});
for (const [name, Page, action] of [
  ["sign-in", SignIn, "login"],
  ["sign-up", SignUp, "register"],
] as const) {
  it(`${name} waits for session and displays only the infinite spinner`, () => {
    fixture.loading = true;
    const html = renderToStaticMarkup(createElement(Page));
    fixture.effects[0]!();
    expect(html).toContain('data-spinner="infinite"');
    expect(html).toContain('role="status"');
    expect(fixture[action]).not.toHaveBeenCalled();
  });
  it(`${name} starts OAuth once with home as destination, including effect replay`, () => {
    renderToStaticMarkup(createElement(Page));
    fixture.effects[0]!();
    fixture.effects[0]!();
    expect(fixture[action]).toHaveBeenCalledExactlyOnceWith("/");
  });
  it(`${name} redirects an authenticated user home without starting OAuth`, () => {
    fixture.authenticated = true;
    renderToStaticMarkup(createElement(Page));
    fixture.effects[0]!();
    expect(fixture.replace).toHaveBeenCalledExactlyOnceWith("/");
    expect(fixture[action]).not.toHaveBeenCalled();
  });
  it(`${name} shows the 500 page on session/action error without retrying`, () => {
    fixture.error = new Error("Unavailable");
    expect(renderToStaticMarkup(createElement(Page))).toContain("500");
    fixture.effects[0]!();
    expect(fixture[action]).not.toHaveBeenCalled();
  });
  it(`${name} does not overlap an existing sign-in action`, () => {
    fixture.signingIn = true;
    renderToStaticMarkup(createElement(Page));
    fixture.effects[0]!();
    expect(fixture[action]).not.toHaveBeenCalled();
  });
  it(`${name} handles rejected actions without an unhandled rejection`, async () => {
    fixture[action].mockRejectedValueOnce(new Error("Unavailable"));
    renderToStaticMarkup(createElement(Page));
    fixture.effects[0]!();
    await Promise.resolve();
    expect(fixture.failed).toHaveBeenCalledWith(true);
  });
}
