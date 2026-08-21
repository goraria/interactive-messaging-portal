import { createClient as createSupabaseClient } from "@gorth/structure/cores/supabase/index"

function createConfiguredClient(url: string, anonKey: string) {
  return createSupabaseClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 20,
      },
    },
  })
}

type SupabaseBrowserClient = ReturnType<typeof createConfiguredClient>

const globalForSupabase = globalThis as typeof globalThis & {
  __gorthSupabaseBrowserClient?: SupabaseBrowserClient
}

export function createSupabaseBrowserClient() {
  if (typeof window === "undefined") {
    return null
  }

  if (globalForSupabase.__gorthSupabaseBrowserClient) {
    return globalForSupabase.__gorthSupabaseBrowserClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  const client = createConfiguredClient(supabaseUrl, supabaseAnonKey)

  globalForSupabase.__gorthSupabaseBrowserClient = client

  return client
}

export const createClient = createSupabaseBrowserClient
