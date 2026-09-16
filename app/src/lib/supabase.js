import { createClient } from '@supabase/supabase-js'

// A cold start from the home-screen icon is the worst case for a stored token:
// the phone has been asleep for hours, the access token expired while nothing
// was running, and the first screen fires its queries in the same breath as the
// library starts renewing it. The request that loses that race comes back 401
// "JWT expired", which every screen used to print in red — and a reload fixed
// it, because by then the new token existed.
//
// So the renewal happens here instead, once, for every request in the app: a
// 401 means "try again with a fresh token", not "show the user an error". One
// retry only — if the second attempt fails too, the session really is gone and
// the caller should hear about it.
async function fetchWithRetry(input, init) {
  const response = await fetch(input, init)
  if (response.status !== 401) return response

  // A 401 from the auth endpoint *is* the renewal failing. Retrying it here
  // would be asking the same broken question twice.
  const url = typeof input === 'string' ? input : input.url
  if (url.includes('/auth/v1/')) return response

  const { data, error } = await supabase.auth.refreshSession()
  if (error || !data.session) return response

  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${data.session.access_token}`)
  return fetch(input, { ...init, headers })
}

// One shared client for the whole app, created once and imported everywhere.
// Two clients would each hold their own session and fight over the refresh token.
// The keys come from .env.local; Vite only exposes variables prefixed VITE_.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { global: { fetch: fetchWithRetry } },
)
