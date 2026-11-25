import { handle } from "@hono/vercel";
import { Hono } from "hono";
import { http, httpError, httpNotFound, httpMethods } from "@/middlewares/http";
import { sharedRoutes } from "@/routes/shared";

const router = new Hono();
router.use(http);
router.onError(httpError);
router.notFound(httpNotFound);
router.use(httpMethods(router));
router.route("/", sharedRoutes);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = handle(router);
export const HEAD = handle(router);
export const OPTIONS = handle(router);
