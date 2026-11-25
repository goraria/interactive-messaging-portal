import { ProgressProvider } from "@/hooks/use-progress";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@gorth-com/primitive/cores/progress/next", () => ({
  useProgress: () => ({ start: state.start, stop: state.stop }),
}));
vi.mock("@gorth-com/primitive/custom/toast", () => ({
  toast: { add: state.toast },
}));
vi.mock("@/queries/auth", () => ({
  login: state.login,
  register: state.register,
  useAuthAccount: () => ({
    account: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
  useAuthLogoutMutation: () => [vi.fn(), { isLoading: false }],
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
import { AuthProvider } from "@/providers/auth";
import { useAuth } from "@/hooks/use-auth";

// Exercise the provider's real action closures without starting OAuth or a browser.
function actions() {
  let auth!: ReturnType<typeof useAuth>;
  function Consumer() {
    auth = useAuth();
    return null;
  }
  renderToStaticMarkup(
    createElement(
      ProgressProvider,
      null,
      createElement(AuthProvider, null, createElement(Consumer)),
    ),
  );
  return auth;
}
beforeEach(() => {
  vi.resetAllMocks();
  state.login.mockResolvedValue(undefined);
  state.register.mockResolvedValue(undefined);
});

it("starts progress immediately and suppresses overlapping sign-in/register actions", async () => {
  let finish!: () => void;
  state.login.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const auth = actions();
  const pending = auth.login("/chat");
  await auth.login("/lab");
  await auth.register("/demo");
  expect(state.start).toHaveBeenCalledOnce();
  expect(state.login).toHaveBeenCalledExactlyOnceWith("/chat");
  expect(state.register).not.toHaveBeenCalled();
  finish();
  await pending;
  expect(state.stop).not.toHaveBeenCalled();
});

it("stops progress and permits retry after a failed request without exposing provider errors", async () => {
  state.login.mockRejectedValueOnce(new Error("private provider diagnostics"));
  const auth = actions();
  await auth.login("/chat");
  expect(state.stop).toHaveBeenCalledOnce();
  expect(state.toast).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "error",
      description: "Sign in is unavailable. Please try again.",
    }),
  );
  expect(JSON.stringify(state.toast.mock.calls)).not.toContain(
    "private provider diagnostics",
  );
  await auth.login("/chat");
  expect(state.login).toHaveBeenCalledTimes(2);
  expect(state.start).toHaveBeenCalledTimes(2);
});

it("uses the same progress flow for registration at SSO", async () => {
  await actions().register("/chat");
  expect(state.register).toHaveBeenCalledExactlyOnceWith("/chat");
  expect(state.start).toHaveBeenCalledOnce();
  expect(state.stop).not.toHaveBeenCalled();
});
