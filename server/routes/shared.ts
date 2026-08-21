import path from "path"
import { Router } from "express"

const router = Router()
const assetsRoot = path.resolve(process.cwd(), "assets")

router.get("/favicon.ico", (req, res) => {
  res.sendFile("favicon.ico", { root: assetsRoot })
})

router.get("/globals.css", (req, res) => {
  res.sendFile("globals.css", { root: assetsRoot })
})

router.get("/", (req, res) => {
  res.sendFile("index.html", { root: assetsRoot })
})

router.get("/api", (_req, res) => {
  res.send("Professor Synapse API is running")
})

router.get("/health", (_req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  })
})

router.get("/param/:param", (req, res) => {
  const { param } = req.params

  res.status(200).json({
    param,
  })
})

router.get("/query", (req, res) => {
  const { query } = req.query

  res.status(200).json({
    query,
  })
})

export default router
