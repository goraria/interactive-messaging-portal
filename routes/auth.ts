import { handle } from "@hono/vercel";
import { Hono } from "hono";
import {
  http,
  httpError,
  httpNotFound,
  httpMethods,
} from "@/middlewares/http";
import { requireAuth } from "@/middlewares/auth";
import {
  actSync,
  actBackchannelLogout,
  actNativeAuth,
  actSyncMethodNotAllowed,
} from "@/controllers/auth";

export const authRoutes = new Hono();
authRoutes.get("/", actNativeAuth);
authRoutes.post("/", actNativeAuth);
authRoutes.get("/*", actNativeAuth);
authRoutes.post("/*", actNativeAuth);

function createAuthEndpoint() {
  const router = new Hono();
  router.use(http);
  router.onError(httpError);
  router.notFound(httpNotFound);
  router.use(httpMethods(router));
  return router
}

const syncEndpoint = createAuthEndpoint();
syncEndpoint.post(
  "/auth/sync",
  requireAuth({ freshProfile: true }),
  actSync,
);
syncEndpoint.all("/auth/sync", actSyncMethodNotAllowed);
export const handleAuthSync = handle(syncEndpoint);

const backchannelEndpoint = createAuthEndpoint();
backchannelEndpoint.post("/auth/sign-out/back-channel", actBackchannelLogout);
backchannelEndpoint.get("/auth/sign-out/back-channel", actNativeAuth);
export const handleAuthBackchannel = handle(backchannelEndpoint);
