import { handleBackgroundApi as handler } from "@/lib/background-handler"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const GET = handler
export const HEAD = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const OPTIONS = handler
