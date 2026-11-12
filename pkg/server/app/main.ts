import { serve } from "@gorth/principle/cores/hono/server"

import app from "@/app/index"
import { port } from "@/utils/environment"

serve({ fetch: app.fetch, port: Number(port ?? 5050) })
