import {
  createClient as createAdminClient,
  SupabaseClient,
} from "@gorth/structure/cores/supabase/index"

export function createAdministrator(): SupabaseClient {
  const supabase = createAdminClient(
    process.env.EXPRESS_PUBLIC_SUPABASE_URL!,
    process.env.EXPRESS_PRIVATE_SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  return supabase;
}
