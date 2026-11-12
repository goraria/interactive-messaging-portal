import { readFile } from "node:fs/promises"
import { extname, resolve } from "node:path"

import { Hono, type Context, type Handler } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"

export type NextFunction = (error?: unknown) => void | Promise<void>

export interface Request {
  raw: globalThis.Request
  body: any
  cookies: Record<string, string>
  headers: Record<string, string>
  method: string
  originalUrl: string
  params: Record<string, string>
  path: string
  query: Record<string, string>
  ip: string
  sessionID: string
  user?: any
  supabase?: any
  authSession?: any
  get(name: string): string | undefined
}

export interface Response {
  locals: Record<string, any>
  status(code: number): Response
  json(value: unknown): globalThis.Response
  send(value?: unknown): globalThis.Response
  sendStatus(code: number): globalThis.Response
  redirect(url: string, status?: number): globalThis.Response
  setHeader(name: string, value: string): Response
  cookie(name: string, value: string, options?: Record<string, any>): Response
  clearCookie(name: string, options?: Record<string, any>): Response
  sendFile(path: string, options?: { root?: string }): Promise<globalThis.Response>
}

export type LegacyHandler = (
  request: Request,
  response: Response,
  next: NextFunction,
) => unknown | Promise<unknown>

const bodyCache = new WeakMap<globalThis.Request, Promise<any>>()

function requestBody(context: Context) {
  const cached = bodyCache.get(context.req.raw)
  if (cached) return cached

  const body = (async () => {
    if (["GET", "HEAD"].includes(context.req.method)) return {}

    const contentType = context.req.header("content-type") ?? ""
    if (contentType.includes("application/json")) {
      return context.req.json().catch(() => ({}))
    }
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      return context.req.parseBody().catch(() => ({}))
    }
    return {}
  })()

  bodyCache.set(context.req.raw, body)
  return body
}

function contentType(path: string) {
  switch (extname(path)) {
    case ".html":
      return "text/html; charset=utf-8"
    case ".css":
      return "text/css; charset=utf-8"
    case ".ico":
      return "image/x-icon"
    case ".svg":
      return "image/svg+xml"
    default:
      return "application/octet-stream"
  }
}

async function legacyRequest(context: Context): Promise<Request> {
  const headers = Object.fromEntries(context.req.raw.headers.entries())

  return {
    raw: context.req.raw,
    body: await requestBody(context),
    cookies: getCookie(context),
    headers,
    method: context.req.method,
    originalUrl: context.req.url,
    params: context.req.param(),
    path: context.req.path,
    query: context.req.query(),
    ip:
      context.req.header("x-real-ip") ??
      context.req.header("x-forwarded-for")?.split(",").at(-1)?.trim() ??
      "unknown",
    sessionID: "",
    get: (name) => context.req.header(name),
  }
}

function legacyResponse(context: Context): Response & {
  last?: globalThis.Response
} {
  let statusCode = 200
  const responseHeaders: Record<string, string> = {}
  const locals =
    (context.get("legacyLocals") as Record<string, any> | undefined) ?? {}
  context.set("legacyLocals", locals)

  const response: Response & { last?: globalThis.Response } = {
    locals,
    status(code) {
      statusCode = code
      return response
    },
    json(value) {
      response.last = context.json(value as any, statusCode as any, responseHeaders)
      return response.last
    },
    send(value = null) {
      response.last =
        typeof value === "string"
          ? context.body(value, statusCode as any, responseHeaders)
          : context.json(value as any, statusCode as any, responseHeaders)
      return response.last
    },
    sendStatus(code) {
      response.last = context.body(null, code as any, responseHeaders)
      return response.last
    },
    redirect(url, status = 302) {
      response.last = context.redirect(url, status as any)
      return response.last
    },
    setHeader(name, value) {
      responseHeaders[name] = value
      context.header(name, value)
      return response
    },
    cookie(name, value, options = {}) {
      setCookie(context, name, value, options)
      return response
    },
    clearCookie(name, options = {}) {
      deleteCookie(context, name, options)
      return response
    },
    async sendFile(path, options = {}) {
      const filePath = options.root ? resolve(options.root, path) : resolve(path)
      const data = await readFile(filePath)
      responseHeaders["content-type"] = contentType(filePath)
      response.last = new globalThis.Response(data, {
        status: statusCode,
        headers: responseHeaders,
      })
      return response.last
    },
  }

  return response
}

export function handleLegacy(handler: LegacyHandler): Handler {
  return async (context, next) => {
    const request = await legacyRequest(context)
    const response = legacyResponse(context)
    let nextResponse: void | globalThis.Response = undefined

    const result = await handler(request, response, async (error) => {
      if (error) throw error
      nextResponse = await next()
    })

    if (result instanceof globalThis.Response) return result
    if (response.last) return response.last
    return nextResponse
  }
}

class HonoRouter {
  readonly hono = new Hono()
  private readonly defaults: LegacyHandler[] = []

  use(...handlers: LegacyHandler[]) {
    this.defaults.push(...handlers)
    return this
  }

  private register(
    method: "get" | "post" | "put" | "patch" | "delete" | "options" | "all",
    path: string,
    handlers: LegacyHandler[],
  ) {
    const adapted = [...this.defaults, ...handlers].map(handleLegacy)
    ;(this.hono as any)[method](path, ...adapted)
    return this
  }

  get(path: string, ...handlers: LegacyHandler[]) {
    return this.register("get", path, handlers)
  }
  post(path: string, ...handlers: LegacyHandler[]) {
    return this.register("post", path, handlers)
  }
  put(path: string, ...handlers: LegacyHandler[]) {
    return this.register("put", path, handlers)
  }
  patch(path: string, ...handlers: LegacyHandler[]) {
    return this.register("patch", path, handlers)
  }
  delete(path: string, ...handlers: LegacyHandler[]) {
    return this.register("delete", path, handlers)
  }
  options(path: string, ...handlers: LegacyHandler[]) {
    return this.register("options", path, handlers)
  }
  all(path: string, ...handlers: LegacyHandler[]) {
    return this.register("all", path, handlers)
  }
}

export function Router() {
  return new HonoRouter()
}
