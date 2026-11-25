import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

const timings = new AsyncLocalStorage<Map<string, number>>();

export async function measureRequest<T>(
  name: string,
  operation: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  try {
    return await operation();
  } finally {
    const current = timings.getStore();
    current?.set(name, (current.get(name) ?? 0) + performance.now() - started);
  }
}

export async function withRequestTiming<T>(operation: () => Promise<T>) {
  const values = new Map<string, number>();
  const started = performance.now();
  const result = await timings.run(values, operation);
  values.set("total", performance.now() - started);
  return {
    result,
    header: [...values]
      .map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`)
      .join(", "),
  };
}
