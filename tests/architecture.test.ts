import { readFile, readdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { expect, it } from "vitest"

const root = fileURLToPath(new URL("../", import.meta.url))
async function sources(directory: string): Promise<string[]> {
  const entries = await readdir(root + directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (entry.isDirectory())
      files.push(...(await sources(directory + "/" + entry.name)))
    else if (/\.(ts|tsx)$/.test(entry.name))
      files.push(directory + "/" + entry.name)
  }
  return files
}

it("reserves Chat API names ahead of the dynamic conversation page", async () => {
  for (const domain of [
    "user",
    "conversation",
    "room",
    "message",
    "reaction",
    "receipt",
    "attachment",
  ]) {
    const bridge = await readFile(
      root + `app/(api)/chat/${domain}/[[...path]]/route.ts`,
      "utf8"
    )
    expect(bridge).toContain('from "@/lib/background-handler"')
    expect(bridge).toContain('runtime = "nodejs"')
    expect(bridge).not.toContain("serverUrl")
  }
  const handler = await readFile(root + "lib/background-handler.ts", "utf8")
  expect(handler).toContain('from "@/app/api"')
  expect(handler).not.toContain("serverUrl")
})

it("keeps Next config minimal, without legacy HTTP server forwarding or archive imports", async () => {
  const config = await readFile(root + "next.config.ts", "utf8")
  expect(config).not.toMatch(/webpack|serverUrl|source:\s*["']\/chat\/:path/)
  expect(config).not.toMatch(/rewrites|turbopack|node:|utils\//)
  const directories = [
    "app",
    "controllers",
    "middlewares",
    "routes",
    "services",
    "lib",
    "utils",
  ]
  for (const directory of directories) {
    for (const file of await sources(directory)) {
      const content = await readFile(root + file, "utf8")
      expect(content, file).not.toMatch(
        /from\s+["'][^"']*(?:\/pkg\/|@\/lib\/http|@\/lib\/utils)/
      )
      expect(content, file).not.toContain("/proxy/chat")
      if (file !== "utils/environment.ts")
        expect(content, file).not.toContain("process.env")
    }
  }
})

it("preserves caller and fetcher exactly from the archived client", async () => {
  for (const file of ["caller.tsx", "fetcher.ts"]) {
    expect(await readFile(root + "utils/" + file, "utf8")).toBe(
      (await readFile(root + "pkg/client/utils/" + file, "utf8")).replaceAll(
        "@gorth/",
        "@gorth-io/"
      )
    )
  }
})
