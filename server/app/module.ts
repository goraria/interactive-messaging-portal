import express, { Request, Response, NextFunction } from "express"
import session from "express-session"
import { Logger } from "@gorth/mechanism/lib/logger"
import { corsConfig } from "@gorth/mechanism/configs/cors"
import { helmetConfig } from "@gorth/mechanism/configs/helmet"
import { morganMiddleware } from "@gorth/mechanism/configs/morgan"
import { bodyParserConfig } from "@gorth/mechanism/configs/body-parser"
import { cookieParserConfig } from "@gorth/mechanism/configs/cookie-parser"
import {
  getCorsOrigins,
  isProduction,
  sessionSecret,
} from "@/lib/utils/environment"
import { authRoutes } from "@/routes/auth"
import { conversationMembersRoutes } from "@/routes/conversation-members"
import { conversationsRoutes } from "@/routes/conversations"
import { messageAttachmentsRoutes } from "@/routes/message-attachments"
import { messageReactionsRoutes } from "@/routes/message-reactions"
import { messageReceiptsRoutes } from "@/routes/message-receipts"
import { messagesRoutes } from "@/routes/messages"
import { realtimeRoutes } from "@/routes/realtime"
import { usersRoutes } from "@/routes/users"
import labRoutes from "@/routes/lab"
import sharedRoutes from "@/routes/shared"

export async function AppModule() {
  const app = express()

  // ================================
  // 🌐 EXPRESS SERVER CONFIGURATION
  // ================================

  /* CONFIGURATIONS */
  app.use(helmetConfig())
  app.use(morganMiddleware())

  //   res.on('finish', () => {
  //     const duration = Date.now() - startTime;
  //     const method = req.method;
  //     const url = req.url;
  //     const status = res.statusCode;
  //     const durationMs = `${duration}ms`;

  //     console.log(`${method} ${url} ${status} in ${durationMs}`);
  //   });

  //   next();
  // });

  // app.use(
  //   express.urlencoded({
  //     extended: true,
  //     limit: "50mb",
  //   })
  // )

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
        // expires: new Date(Date.now() + 1000 * 60 * 60 * 24), // Thời gian hết hạn cookie
        // secure: true, // Chỉ gửi cookie qua HTTPS
        // sameSite: 'Lax' // Hoặc 'Strict'. 'None' cần secure: true
        // path: '/', // Phạm vi cookie (thường là gốc)
      },
    })
  )

  app.use(
    corsConfig({
      origin: isProduction ? getCorsOrigins() : true,
      credentials: true,
    })
  )

  /* ROUTES */
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
  return app
}
