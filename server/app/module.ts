import express, { Request, Response, NextFunction } from "express"
import path from "path";
import dotenv from 'dotenv';
import session from "express-session";
import { Logger } from "@gorth/mechanism/lib/logger"
import {
  corsConfig,
  helmetConfig,
  morganMiddleware,
  bodyParserConfig,
  cookieParserConfig,
} from "@/lib/mechanism/config/index"
import {
  allowedRedirectOrigins,
  expressClientUrl,
  expressLocalUrl,
  isExpressProduction,
} from "@/lib/utils/environment"
import authRoutes from "@/routes/auth"
import chatRoutes from "@/routes/chat"
import labRoutes from "@/routes/lab"
import sharedRoutes from "@/routes/shared"

export default async function AppModule() {
  const app = express()

  // ================================
  // 🌐 EXPRESS SERVER CONFIGURATION
  // ================================

  /* CONFIGURATIONS */
  dotenv.config({
    path: ".env.local",
    override: true,
    debug: false,
    quiet: true,
  })

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
      secret: process.env.EXPRESS_JWT_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.EXPRESS_ENV === "production",
        httpOnly: true,
        maxAge: 30 * 60 * 60 * 24,
        sameSite: "lax",
        // expires: new Date(Date.now() + 1000 * 60 * 60 * 24), // Thời gian hết hạn cookie
        // domain: process.env.EXPRESS_CLIENT_URL!, // Tùy chọn: tên miền cookie
        // secure: true, // Chỉ gửi cookie qua HTTPS
        // sameSite: 'Lax' // Hoặc 'Strict'. 'None' cần secure: true
        // path: '/', // Phạm vi cookie (thường là gốc)
      },
    })
  )

  const productionOrigins = [
    expressClientUrl,
    expressLocalUrl,
    ...((allowedRedirectOrigins ?? "").split(",")),
  ]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin))

  app.use(
    corsConfig({
      origin: isExpressProduction ? productionOrigins : true,
      credentials: true,
    }),
  )

  /* ROUTES */
  app.use("/auth", authRoutes)
  app.use("/chat", chatRoutes)
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
      message: isExpressProduction ? "Something went wrong" : error.message,
    })
  })
  // app.use(createRealtime);

  return app
}
