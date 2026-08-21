import type { Request, Response } from "express"
import type { AuthContext } from "@/middlewares/auth"

export function labAuth(_request: Request, response: Response) {
  const auth = response.locals.auth as AuthContext

  return response.json(auth)
}
