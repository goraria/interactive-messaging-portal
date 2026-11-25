import { Hono } from "hono";
import {
  actCreateUser,
  actDeleteUser,
  actGetCurrentUser,
  actGetUser,
  actListUsers,
  actUpdateUser,
} from "@/controllers/users";
import { requireAuth } from "@/middlewares/auth";

export const usersRoutes = new Hono();
usersRoutes.get("/", requireAuth(), actListUsers);
usersRoutes.post("/", requireAuth(), actCreateUser);
usersRoutes.get("/me", requireAuth(), actGetCurrentUser);
usersRoutes.get("/:id", requireAuth(), actGetUser);
usersRoutes.patch("/:id", requireAuth(), actUpdateUser);
usersRoutes.delete("/:id", requireAuth(), actDeleteUser);
