import { handle } from "@hono/vercel";
import { Hono } from "hono";
import { http, httpError, httpNotFound, httpMethods } from "@/middlewares/http";
import { labRoutes } from "@/routes/lab";
import { usersRoutes } from "@/routes/users";
import { conversationRoutes } from "@/routes/conversation";
import { messageRoutes } from "@/routes/message";
import { attachmentRoutes } from "@/routes/attachment";
import { blockRoutes } from "@/routes/block";
import { callRoutes } from "@/routes/call";
import { eventRoutes } from "@/routes/event";
import { sharedRoutes } from "@/routes/shared";

const router = new Hono();

router.use(http);
router.onError(httpError);
router.notFound(httpNotFound);
router.use(httpMethods(router));

router.route("/internal/user", usersRoutes);
router.route("/internal/conversation", conversationRoutes);
router.route("/internal/message", messageRoutes);
router.route("/internal/attachment", attachmentRoutes);
router.route("/internal/block", blockRoutes);
router.route("/internal/call", callRoutes);
router.route("/internal/event", eventRoutes);
router.route("/internal/lab", labRoutes);
router.route("/internal", sharedRoutes);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(router);
export const HEAD = handle(router);
export const POST = handle(router);
export const PUT = handle(router);
export const PATCH = handle(router);
export const DELETE = handle(router);
export const OPTIONS = handle(router);
