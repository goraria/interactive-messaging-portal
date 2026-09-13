import express from "express"
import type { NextFunction, Request, Response } from "express"
import session from "express-session"
import { morganMiddleware } from "@gorth/mechanism/configs/morgan"
import { Logger } from "@gorth/mechanism/lib/logger"

import { bodyParserConfig } from "@gorth/mechanism/configs/body-parser"
import { cookieParserConfig } from "@gorth/mechanism/configs/cookie-parser"
import { corsConfig } from "@gorth/mechanism/configs/cors"
import { helmetConfig } from "@gorth/mechanism/configs/helmet"
import {
  getCorsOrigins,
  isProduction,
  sessionSecret,
} from "@/lib/utils/environment"
import { authRoutes } from "@/routes/auth"
import { conversationMembersRoutes } from "@/routes/conversation-members"
import { conversationsRoutes } from "@/routes/conversations"
import labRoutes from "@/routes/lab"
import { messageAttachmentsRoutes } from "@/routes/message-attachments"
import { messageReactionsRoutes } from "@/routes/message-reactions"
import { messageReceiptsRoutes } from "@/routes/message-receipts"
import { messagesRoutes } from "@/routes/messages"
import { realtimeRoutes } from "@/routes/realtime"
import sharedRoutes from "@/routes/shared"
import { usersRoutes } from "@/routes/users"

const app = express()

if (isProduction) {
  app.set("trust proxy", 1)
}

app.use(
  corsConfig({
    origin: isProduction ? getCorsOrigins() : true,
    credentials: true,
  })
)
app.use(helmetConfig())

if (isProduction) {
  app.use(morganMiddleware())
}

app.use(bodyParserConfig())
app.use(cookieParserConfig())
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      maxAge: 30 * 60 * 60 * 24,
      sameSite: "lax",
    },
  })
)

app.use("/auth", authRoutes())
app.use("/chat", usersRoutes())
app.use("/chat", conversationsRoutes())
app.use("/chat", conversationMembersRoutes())
app.use("/chat", messagesRoutes())
app.use("/chat", realtimeRoutes())
app.use("/chat", messageAttachmentsRoutes())
app.use("/chat", messageReactionsRoutes())
app.use("/chat", messageReceiptsRoutes())
app.use("/lab", labRoutes)
app.use("/", sharedRoutes)

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.url} not found`,
  })
})

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.log(Logger(`Error: ${error}`, "error", "red"))
  res.status(500).json({
    error: "Internal Server Error",
    message: isProduction ? "Something went wrong" : error.message,
  })
})

export default app
