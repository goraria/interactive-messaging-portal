import { readFileSync, existsSync } from "node:fs"
import { expect, it } from "vitest"

it("keeps GorCer branding and exact white-icon size variants consistent", () => {
  const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8")
  expect(read("utils/constant.ts")).toContain('name: "GorCer"')
  for (const [file, size, offset, scale, radius] of [
    ["public/brand/sidebar.svg", 36, 10, 2 / 3, 6],
    ["public/brand/logo.svg", 56, 10, 1.5, 8],
    ["app/icon.svg", 56, 10, 1.5, 8],
  ] as const) {
    const svg = read(file)
    expect(svg).toContain('fill="#EC6683"')
    expect(svg).toContain('stroke="#fff"')
    expect(svg).toContain('viewBox="0 0 ' + size + ' ' + size + '"')
    expect(svg).toContain('rx="' + radius + '"')
    expect(svg).toContain('translate(' + offset + ' ' + offset + ') scale(' + scale + ')')
  }
  expect(read("components/app-brand.tsx")).toContain("alt={appGlobal.name}")
  expect(existsSync(new URL("../app/favicon.ico", import.meta.url))).toBe(false)
})
