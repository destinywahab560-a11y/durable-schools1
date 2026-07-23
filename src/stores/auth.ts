import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  initialized: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, metadata: Record<string, unknown>) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return
    set({ loading: true })

    const { data: { session } } = await supabase.auth.getSession()
    set({ session, user: session?.user ?? null })

    if (session?.user) {
      await get().refreshProfile()
    }

    supabase.auth.onAuthStateChange((event, newSession) => {
      set({ session: newSession, user: newSession?.user ?? null })
      if (event === 'SIGNED_OUT') {
        set({ profile: null })
      } else if (newSession?.user) {
        ;(async () => {
          await get().refreshProfile()
        })()
      }
    })

    set({ loading: false, initialized: true })
  },

  refreshProfile: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', get().user?.id ?? '')
      .maybeSingle()

    if (error) {
      console.error('Error fetching profile:', error)
      return
    }
    set({ profile: data as Profile | null })
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    set({ loading: false })
    if (error) return { error: error.message }
    await get().refreshProfile()
    return { error: null }
  },

  signUp: async (email: string, password: string, metadata: Record<string, unknown>) => {
    set({ loading: true })
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    })
    set({ loading: false })
    if (error) return { error: error.message }
    if (!data.user) return { error: 'Sign-up failed — no user returned.' }

    if (metadata.role === 'admin') {
      // Admin profiles can only be created through this invite-gated
      // function — it checks the admin invite code server-side before
      // creating the profile, and raises an error if it's wrong.
      const { error: rpcError } = await supabase.rpc('register_school_admin', {
        p_school_code: metadata.school_code,
        p_invite_code: metadata.invite_code,
        p_first_name: metadata.first_name,
        p_last_name: metadata.last_name,
        p_phone: metadata.phone ?? null,
        p_email: email
      })
      if (rpcError) {
        console.error('Admin registration error:', rpcError)
        return { error: rpcError.message }
      }
    } else {
      // Insert profile row directly (unchanged for teacher/student/parent)
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        role: metadata.role,
        first_name: metadata.first_name,
        last_name: metadata.last_name,
        email,
        phone: metadata.phone ?? null,
        school_id: metadata.school_id ?? null
      })
      if (profileError) {
        console.error('Profile insert error:', profileError)
        return { error: profileError.message }
      }
    }

    await get().refreshProfile()
    return { error: null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, profile: null })
  }
}))
