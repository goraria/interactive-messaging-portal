import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  toast: vi.fn(),
  effects: [] as Array<() => void | (() => void)>,
  listeners: new Map<string, (event: { persisted: boolean }) => void>(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => void | (() => void)) => {
    fixture.effects.push(effect);
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/auth/sign-in" }));
vi.mock("@gorth-com/primitive/cores/progress/next", () => ({
  useProgress: () => ({ start: fixture.start, stop: fixture.stop }),
}));
vi.mock("@gorth-com/primitive/custom/toast", () => ({
  toast: { add: fixture.toast },
}));
import { ProgressProvider } from "@/hooks/use-progress";
import { useProgress, type ProgressValue } from "@/hooks/use-progress";

function actions() {
  const results: ProgressValue[] = [];
  function Consumer() {
    results.push(useProgress());
    return null;
  }
  renderToStaticMarkup(
    createElement(
      ProgressProvider,
      null,
      createElement(Consumer, { key: "password" }),
      createElement(Consumer, { key: "google" }),
    ),
  );
  return results as [ProgressValue, ProgressValue];
}
beforeEach(() => {
  vi.clearAllMocks();
  fixture.effects = [];
  fixture.listeners.clear();
  vi.stubGlobal("window", {
    addEventListener: (
      name: string,
      listener: (event: { persisted: boolean }) => void,
    ) => fixture.listeners.set(name, listener),
    removeEventListener: (name: string) => fixture.listeners.delete(name),
  });
});
afterEach(() => vi.unstubAllGlobals());

it("starts progress synchronously and locks competing password/Google requests", () => {
  const [password, google] = actions();
  expect(password.start()).toBe(true);
  expect(password.start()).toBe(false);
  expect(google.start()).toBe(false);
  expect(fixture.start).toHaveBeenCalledOnce();
  expect(fixture.stop).not.toHaveBeenCalled();
});
it("stops progress on error, reports it once and permits retry", () => {
  const [password] = actions();
  password.start();
  password.fail("Sign in failed. Please try again.");
  expect(fixture.stop).toHaveBeenCalledOnce();
  expect(fixture.toast).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "error",
      description: "Sign in failed. Please try again.",
    }),
  );
  expect(password.start()).toBe(true);
});
it("does not let a stale operation stop or report an error for a newer action", () => {
  const [password, google] = actions();
  password.start();
  password.finish();
  google.start();
  password.fail("stale failure");
  expect(fixture.stop).toHaveBeenCalledOnce();
  expect(fixture.toast).not.toHaveBeenCalled();
  expect(password.start()).toBe(false);
  google.finish();
  expect(password.start()).toBe(true);
});
it("releases the redirect lock when the browser restores the page from its back cache", () => {
  const [password] = actions();
  const cleanup = fixture.effects[1]!();
  password.start();
  fixture.listeners.get("pageshow")!({ persisted: false });
  expect(password.start()).toBe(false);
  fixture.listeners.get("pageshow")!({ persisted: true });
  expect(fixture.stop).toHaveBeenCalledOnce();
  expect(password.start()).toBe(true);
  if (typeof cleanup === "function") cleanup();
  expect(fixture.listeners.has("pageshow")).toBe(false);
});

it("runs an action once and automatically finishes normal successful work", async () => {
  const [progress] = actions();
  const operation = vi.fn().mockResolvedValue("done");
  expect(await progress.run(operation)).toBe("done");
  expect(operation).toHaveBeenCalledOnce();
  expect(fixture.start).toHaveBeenCalledOnce();
  expect(fixture.stop).toHaveBeenCalledOnce();
  expect(progress.start()).toBe(true);
});
it("holds progress after success until navigation and blocks concurrent run calls", async () => {
  const [first, second] = actions();
  await first.run(async () => "redirect", { keepUntilNavigation: true });
  const duplicate = vi.fn();
  await second.run(duplicate);
  expect(duplicate).not.toHaveBeenCalled();
  expect(fixture.stop).not.toHaveBeenCalled();
  first.finish();
  expect(second.start()).toBe(true);
});
it("catches request failures without leaking provider diagnostics, then permits retry", async () => {
  const [progress] = actions();
  const onError = vi.fn();
  await expect(
    progress.run(
      async () => {
        throw new Error("private provider details");
      },
      {
        errorMessage: "Sign in is unavailable. Please try again.",
        onError,
      },
    ),
  ).resolves.toBeUndefined();
  expect(fixture.stop).toHaveBeenCalledOnce();
  expect(onError).toHaveBeenCalledOnce();
  expect(JSON.stringify(fixture.toast.mock.calls)).not.toContain(
    "private provider details",
  );
  expect(progress.start()).toBe(true);
});

it("ignores a late failed run after the same consumer has started another action", async () => {
  const [progress] = actions();
  let reject!: (error: Error) => void;
  const oldRun = progress.run(
    () =>
      new Promise<void>((_resolve, fail) => {
        reject = fail;
      }),
  );
  progress.finish();
  await progress.run(async () => "new redirect", { keepUntilNavigation: true });
  reject(new Error("old failure"));
  await oldRun;
  expect(fixture.toast).not.toHaveBeenCalled();
  expect(fixture.stop).toHaveBeenCalledOnce();
  expect(progress.start()).toBe(false);
});
