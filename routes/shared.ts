import { Hono } from "hono";
import {
  actHealth,
  actHello,
  actParam,
  actQuery,
  actProtectedResourceMetadata,
} from "@/controllers/shared";

export const sharedRoutes = new Hono();
sharedRoutes.get("/health", actHealth);
sharedRoutes.get("/hello", actHello);
sharedRoutes.get("/param/:param", actParam);
sharedRoutes.get("/query", actQuery);

export const metadataRoutes = new Hono();
metadataRoutes.get(
  "/.well-known/oauth-protected-resource",
  actProtectedResourceMetadata,
);
