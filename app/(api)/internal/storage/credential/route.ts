import { handle } from "@hono/vercel";
import { Hono } from "hono";
import { http, httpError, httpNotFound, httpMethods } from "@/middlewares/http";
import { internalRoutes } from "@/routes/internal";

const router = new Hono();
router.use(http);
router.onError(httpError);
router.notFound(httpNotFound);
router.use(httpMethods(router));
router.route("/internal", internalRoutes);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = handle(router);
export const OPTIONS = handle(router);
