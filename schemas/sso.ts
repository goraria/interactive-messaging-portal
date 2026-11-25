import { z } from "@gorth-com/structure/cores/zod";

export const ssoUserInfoSchema = z.looseObject({
  sub: z.string().min(1).max(255),
  status: z.enum(["active", "inactive", "suspended", "deleted"]).optional(),
});
