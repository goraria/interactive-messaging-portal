import { afterEach, expect, it, vi } from "vitest";
vi.hoisted(() => {
  vi.stubGlobal("window", {});
});
vi.mock("@/utils/caller", () => ({
  defineQuery: (config: unknown) => config,
  defineMutation: (config: unknown) => config,
  createQueryService: (service: {
    queryOptions: (input: unknown) => unknown;
  }) => service.queryOptions,
  createMutationService: () => vi.fn(),
  caller: vi.fn(),
}));
import {
  QueryClient,
  QueryObserver,
  type QueryObserverOptions,
} from "@gorth-com/primitive/cores/tanstack/query";
import { useConversationsQuery, useConversationQuery } from "@/queries/chat";
import { caller } from "@/utils/caller";
import {
  messengerCalls,
  messengerEvents,
  messengerPage,
  sendMessengerMessage,
  startMessengerCall,
} from "@/queries/messenger";

it("uses a single internal prefix for conversation requests", async () => {
  const id = "conversation-a";
  const message = { content: "Hello", clientMessageId: "message-a", assetIds: [] };

  await messengerPage(id, "previous", "hello");
  await sendMessengerMessage(id, message);
  await messengerEvents(id, "5");
  await messengerCalls(id);
  await startMessengerCall(id, "audio", "call-a");

  const prefix = "/internal/conversation/conversation-a";
  expect(vi.mocked(caller).mock.calls.map(([options]) => options.url)).toEqual([
    prefix + "/message",
    prefix + "/message",
    prefix + "/event",
    prefix + "/call",
    prefix + "/call",
  ]);
  expect(caller).toHaveBeenCalledWith(expect.objectContaining({
    url: prefix + "/message",
    method: "POST",
    body: message,
  }));
});

afterEach(() => {
  vi.useRealTimers();
});
it.each(["list", "detail"])(
  "does not poll idle %s, but still refreshes after realtime invalidation",
  async (kind) => {
    vi.useFakeTimers();
    const options = (kind === "list"
      ? useConversationsQuery()
      : useConversationQuery(
          "conversation-a",
        )) as unknown as QueryObserverOptions;
    const client = new QueryClient();
    const fetch = vi.fn().mockResolvedValue({ id: "conversation-a" });
    const observer = new QueryObserver(client, {
      ...options,
      queryKey: [kind],
      queryFn: fetch,
    });
    const stop = observer.subscribe(() => {});
    try {
      await vi.advanceTimersByTimeAsync(60000);
      expect(fetch).toHaveBeenCalledOnce();
      await client.invalidateQueries({ queryKey: [kind] });
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      stop();
      client.clear();
    }
  },
);
