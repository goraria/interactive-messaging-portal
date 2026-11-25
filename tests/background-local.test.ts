import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ run: vi.fn(), delay: vi.fn() }));
vi.mock("@/services/background", () => ({ rawProcessBackgroundJob: state.run }));
vi.mock("@/models/chat-delivery", () => ({
  rawNextChatDeliveryDelay: state.delay,
}));
import {
  rawDrainLocalBackground,
  rawStartLocalBackgroundWorker,
} from "@/services/background-local";

beforeEach(() => {
  vi.useFakeTimers();
  state.run.mockReset().mockResolvedValue(undefined);
  state.delay.mockReset().mockResolvedValue(null);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("coalesces concurrent requests and drains writes arriving during a drain", async () => {
  let release!: () => void;
  state.run.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const first = rawDrainLocalBackground();
  const second = rawDrainLocalBackground();
  expect(first).toBe(second);
  release();
  await first;
  expect(state.run).toHaveBeenCalledTimes(2);
});

it("retries a failed delivery when the persisted backoff becomes due", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.run.mockRejectedValueOnce(new Error("upstream unavailable"));
  state.delay.mockResolvedValueOnce(20000);
  await rawDrainLocalBackground();
  await vi.advanceTimersByTimeAsync(19999);
  expect(state.run).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(state.run).toHaveBeenCalledTimes(2);
});

it("recovers pending work at startup then stops querying an empty outbox", async () => {
  rawStartLocalBackgroundWorker();
  await vi.advanceTimersByTimeAsync(1);
  expect(state.run).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(60000);
  expect(state.run).toHaveBeenCalledOnce();
  expect(state.delay).toHaveBeenCalledOnce();
});
