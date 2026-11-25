import "server-only";
import { rawProcessBackgroundJob } from "@/services/background";
import { rawNextChatDeliveryDelay } from "@/models/chat-delivery";

// The database is the queue. Timers only wake this local process; restarts recover
// unfinished rows and leases. Production on Vercel keeps its native Queue trigger.
const state = globalThis as typeof globalThis & {
  chatBackgroundWorker?: {
    running?: Promise<void>;
    timer?: ReturnType<typeof setTimeout>;
    requested: boolean;
  };
};
const worker = (state.chatBackgroundWorker ??= { requested: false });

function schedule(delay: number) {
  clearTimeout(worker.timer);
  worker.timer = setTimeout(
    () => {
      worker.timer = undefined;
      void rawDrainLocalBackground();
    },
    Math.min(delay, 2_147_483_647),
  );
  worker.timer.unref?.();
}

export function rawDrainLocalBackground(): Promise<void> {
  worker.requested = true;
  clearTimeout(worker.timer);
  if (worker.running) return worker.running;
  worker.running = (async () => {
    let failed = false;
    do {
      worker.requested = false;
      try {
        await rawProcessBackgroundJob({ kind: "drain" });
      } catch {
        failed = true;
        console.error(
          "[background] local_delivery_deferred; durable outbox will retry",
        );
      }
    } while (worker.requested && !failed);
    try {
      const delay = await rawNextChatDeliveryDelay();
      if (delay !== null) schedule(Math.max(1000, delay));
      else if (failed) schedule(15000);
    } catch {
      schedule(15000);
    }
  })().finally(() => {
    worker.running = undefined;
    if (worker.requested) schedule(0);
  });
  return worker.running;
}

export function rawStartLocalBackgroundWorker() {
  if (!worker.running && !worker.timer) schedule(0);
}
