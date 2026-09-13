import { Rest } from "ably"

import { ablyApiKey } from "@/lib/utils/environment"

let ably: Rest | undefined

export function getAbly() {
  if (!ablyApiKey) {
    throw new Error("ABLY_API_KEY is required")
  }

  ably ??= new Rest({ key: ablyApiKey })
  return ably
}
