import { Response } from "express";

export function handleError(res: Response, e: any) {
  const status = e?.status || 500;
  const payload: any = { ok: false, error: e?.message || "Internal Server Error" };
  if (e?.details) payload.details = e.details;
  return res.status(status).json(payload);
}

export function httpError(status: number, message: string, details?: unknown) {
  const e = new Error(message) as any;
  e.status = status;
  if (details) e.details = details;
  return e;
}
