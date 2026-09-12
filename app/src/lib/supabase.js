import { createClient } from '@supabase/supabase-js'

// One shared client for the whole app, created once and imported everywhere.
// Two clients would each hold their own session and fight over the refresh token.
// The keys come from .env.local; Vite only exposes variables prefixed VITE_.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
