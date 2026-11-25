import { timingSafeEqual } from "node:crypto";
import { cronSecret } from "@/utils/environment";
import {
  rawEnqueueBackgroundJob,
  rawBackgroundCallback,
} from "@/services/background";

export async function actRecover(request: Request) {
  if (!cronSecret) return new Response(null, { status: 503 });
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from("Bearer " + cronSecret);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return new Response(null, { status: 401 });
  await rawEnqueueBackgroundJob();
  return Response.json({ queued: true });
}

export function actDeliver(request: Request) {
  return rawBackgroundCallback(request);
}
