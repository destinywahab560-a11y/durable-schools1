import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

// Used whenever an Admin creates ANOTHER person's login (a student or a
// teacher). A plain supabase.auth.signUp() call on the main client would
// silently replace the Admin's own active session with the newly
// created user's session the moment it succeeds — logging the Admin out
// mid-flow without any visible warning, and breaking every RLS check
// that follows (since auth.uid() would now be the new user, not the
// Admin). This throwaway client never touches or persists a session, so
// it can create the new auth user without disturbing who's logged in.
export async function signUpWithoutSessionSwap(
  email: string,
  password: string,
  metadata: Record<string, unknown>
) {
  const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  return tempClient.auth.signUp({ email, password, options: { data: metadata } })
}
