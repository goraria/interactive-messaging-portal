import { spawn } from "node:child_process"
import { once } from "node:events"
import { fileURLToPath } from "node:url"
import { expect, it } from "vitest"

it("runs real Hono/ws Node upgrades, cross-connection invalidations and membership revocation", async () => {
  const child = spawn(
    "node",
    ["--experimental-strip-types", "tests/fixtures/realtime-server.mjs"],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      stdio: ["ignore", "pipe", "pipe"],
    }
  )
  const sockets: WebSocket[] = []
  let errors = ""
  child.stderr.on("data", (chunk) => {
    errors += chunk.toString()
  })
  try {
    const port = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Node fixture startup timeout: " + errors)),
        5000
      )
      child.once("error", (error) => {
        clearTimeout(timeout)
        reject(error)
      })
      child.once("exit", () => {
        clearTimeout(timeout)
        reject(new Error(errors || "Node fixture exited"))
      })
      child.stdout.once("data", (chunk) => {
        clearTimeout(timeout)
        resolve(Number(chunk.toString().trim()))
      })
    })
    const url = `http://127.0.0.1:${port}`
    expect(
      (
        await fetch(url + "/socket", {
          headers: { origin: "https://attacker.example" },
        })
      ).status
    ).toBe(403)
    const open = async () => {
      const ws = new WebSocket(url.replace("http:", "ws:") + "/socket")
      sockets.push(ws)
      const first = once(ws, "message")
      await once(ws, "open")
      expect(JSON.parse(String((await first)[0].data))).toEqual({
        type: "chat.changed",
        conversationId: "room",
        sequence: "1",
      })
      return ws
    }
    const a = await open(),
      b = await open()
    const changed = [once(a, "message"), once(b, "message")]
    await fetch(url + "/advance", { method: "POST" })
    for (const event of await Promise.all(changed))
      expect(JSON.parse(String(event[0].data)).sequence).toBe("2")
    const closed = [once(a, "close"), once(b, "close")]
    await fetch(url + "/revoke", { method: "POST" })
    for (const event of await Promise.all(closed))
      expect(event[0].code).toBe(4403)
  } finally {
    for (const socket of sockets) socket.close()
    child.kill("SIGTERM")
    if (child.exitCode === null) await once(child, "exit")
  }
})
