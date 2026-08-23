import type { NextFunction, Request, Response } from "express"

import type { AuthContext } from "@/middlewares/auth"
import { syncUser as syncUserService } from "@/services/users"

export async function syncUser(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  const auth = res.locals.auth as AuthContext | undefined

  if (!auth?.user) {
    return res.status(401).json({ error: "unauthorized" })
  }

  try {
    const user = await syncUserService({
      id: auth.user.id,
      name: auth.user.name ?? auth.user.email.split("@")[0] ?? auth.user.email,
      email: auth.user.email,
      image: auth.user.image,
    })

    return res.status(200).json({ data: user })
  } catch (error) {
    return next(error)
  }
}

export function splat(_req: Request, res: Response) {
  return res.status(404).json({ error: "sso_owned_auth_route" })
}

export function me(_req: Request, res: Response) {
  return res.status(401).json({ error: "sso_owned_auth_route" })
}
