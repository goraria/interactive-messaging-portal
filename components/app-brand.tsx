import Image from "next/image"
import { appGlobal } from "@/utils/constant"

export function AppBrand({ variant = "sidebar" }: { variant?: "sidebar" | "footer" }) {
  const large = variant === "footer"
  return (
    <Image
      src={large ? "/brand/logo.svg" : "/brand/sidebar.svg"}
      alt={appGlobal.name}
      width={large ? 56 : 36}
      height={large ? 56 : 36}
      className={large ? "size-14 shrink-0 rounded-lg" : "size-9 shrink-0 rounded-md"}
      unoptimized
    />
  )
}
