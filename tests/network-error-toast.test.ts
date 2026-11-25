import { afterEach, expect, it, vi } from "vitest";
import { isValidElement } from "react";
import { isNetworkError } from "@/utils/network-error";

const state = vi.hoisted(() => ({
  add: vi.fn().mockReturnValue("chat-network-error"),
}));
vi.mock("@gorth-com/primitive/custom/toast", () => ({
  toast: { add: state.add },
}));
import { showNetworkErrorToast } from "@/utils/client/network-toast";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it.each([
  "Network Error",
  new TypeError("Failed to fetch"),
  new Error("Load failed"),
  { code: "ERR_NETWORK" },
  { code: "ETIMEDOUT" },
  "Network connection lost",
])("recognizes network failures: %j", (error) => {
  expect(isNetworkError(error)).toBe(true);
});

it.each([
  null,
  "conversation_forbidden",
  "Message cannot be empty",
  "Report submitted",
  { response: { status: 403 }, message: "Network Error" },
])("keeps application and authorization errors distinct: %j", (error) => {
  expect(isNetworkError(error)).toBe(false);
});

it("uses the existing error toaster with one stable ID and an accessible reload icon action", () => {
  const reload = vi.fn();
  vi.stubGlobal("window", { location: { reload } });
  showNetworkErrorToast();
  showNetworkErrorToast();
  const options = state.add.mock.calls[0]![0];
  expect(options.type).toBe("error");
  expect(isValidElement(options.title)).toBe(true);
  expect(options.title.props.className).toBe("text-destructive");
  expect(options.actionProps["aria-label"]).toBe("Reload chat");
  expect(options.actionProps.className).toContain("text-destructive");
  expect(options.actionProps.children.props.className).toBe("size-4");
  expect(state.add.mock.calls[1]![0].id).toBe(options.id);
  options.actionProps.onClick();
  expect(reload).toHaveBeenCalledOnce();
});
