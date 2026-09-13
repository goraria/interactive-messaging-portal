import {
  createClient as createAdminClient,
  SupabaseClient,
} from "@gorth/structure/cores/supabase/index"
import {
  supabaseServiceRoleKey,
  supabaseUrl,
} from "@/lib/utils/environment"

export function createAdministrator(): SupabaseClient {
  const supabase = createAdminClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  return supabase;
}
