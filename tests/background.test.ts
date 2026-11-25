import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  run: vi.fn(),
  send: vi.fn(),
  policy: vi.fn(),
  local: vi.fn(),
  vercel: false,
}));
vi.mock("@/utils/environment", () => ({
  get vercelDeployment() {
    return state.vercel;
  },
}));
vi.mock("@/services/background-local", () => ({
  rawDrainLocalBackground: state.local,
}));
vi.mock("@vercel/queue", () => ({
  QueueClient: class {
    send = state.send;
    handleCallback = (handler: unknown) => handler;
  },
  registerDevConsumer: vi.fn(),
}));
vi.mock("@/models/chat-delivery", () => ({ rawDispatchChatEvents: state.run }));

import {
  rawProcessBackgroundJob,
  rawEnqueueBackgroundJob,
} from "@/services/background";
beforeEach(() => {
  state.run
    .mockReset()
    .mockResolvedValue({ claimed: 0, delivered: 0, failed: 0 });
  state.send.mockReset().mockResolvedValue({ messageId: "fixture" });
  state.policy.mockReset().mockResolvedValue({ dispatched: true });
  state.local.mockReset().mockResolvedValue(undefined);
  state.vercel = false;
});
it("rejects an unknown queue payload before accessing domain state", async () => {
  await expect(
    rawProcessBackgroundJob({ kind: "execute-arbitrary" }),
  ).rejects.toThrow("Invalid background job");
  expect(state.run).not.toHaveBeenCalled();
});
it("drains durable work without calling its own HTTP/OAuth endpoint", async () => {
  await rawProcessBackgroundJob({ kind: "drain" });
  expect(state.run).toHaveBeenCalledTimes(1);
  expect(state.run).toHaveBeenCalledWith();
});
it("propagates storage failure so the native Queue consumer retries", async () => {
  state.run.mockRejectedValueOnce(new Error("fixture storage offline"));
  await expect(rawProcessBackgroundJob({ kind: "drain" })).rejects.toThrow(
    "fixture storage offline",
  );
});
it("does not acknowledge a domain delivery that was deferred for retry", async () => {
  state.run.mockResolvedValueOnce({ claimed: 1, failed: 1 });
  await expect(rawProcessBackgroundJob({ kind: "drain" })).rejects.toThrow(
    "Background delivery deferred",
  );
});
it("uses the durable local worker under next dev without sending to Vercel", async () => {
  await rawEnqueueBackgroundJob();
  expect(state.local).toHaveBeenCalledOnce();
  expect(state.send).not.toHaveBeenCalled();
});
it("keeps the native Queue on Vercel and propagates enqueue failures", async () => {
  state.vercel = true;
  state.send.mockRejectedValueOnce(new Error("provider unavailable"));
  await expect(rawEnqueueBackgroundJob()).rejects.toThrow("provider unavailable");
  expect(state.local).not.toHaveBeenCalled();
});
