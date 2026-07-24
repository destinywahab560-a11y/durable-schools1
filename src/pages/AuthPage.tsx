import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { ArrowLeft, School, Mail, Phone, Lock, User as UserIcon } from 'lucide-react'

type Mode = 'signin' | 'signup'

export default function AuthPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { signIn, signUp } = useAuthStore()

  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'signup' ? 'signup' : 'signin')
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Sign-in form
  const [signInEmail, setSignInEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')

  // Sign-up form
  const [branch, setBranch] = useState<'DFS-PRIMARY' | 'DCHS-SECONDARY'>('DFS-PRIMARY')
  const [inviteCode, setInviteCode] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'teacher' | 'student' | 'parent'>('admin')
  const [schoolCode, setSchoolCode] = useState('')

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(signInEmail, signInPassword)
    setLoading(false)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Welcome back!')
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle()
        const r = profile?.role
        navigate(r === 'admin' ? '/admin' : r === 'teacher' ? '/teacher' : r === 'student' ? '/student' : '/parent')
      }
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (role === 'admin') {
        const { error } = await signUp(email, password, {
          role: 'admin',
          first_name: firstName,
          last_name: lastName,
          phone,
          school_code: branch,
          invite_code: inviteCode
        })

        if (error) throw new Error(error)
        toast.success('Account created!')
        navigate('/admin')
      } else {
        // Non-admin: need school code
        const { data: school, error: schoolErr } = await supabase
          .from('schools')
          .select('id')
          .eq('code', schoolCode)
          .maybeSingle()

        if (schoolErr || !school) {
          throw new Error('Invalid school code. Please check with your school administrator.')
        }

        const { error } = await signUp(email, password, {
          role,
          first_name: firstName,
          last_name: lastName,
          phone,
          school_id: school.id
        })

        if (error) throw new Error(error)
        toast.success('Account created!')
        navigate(role === 'teacher' ? '/teacher' : role === 'student' ? '/student' : '/parent')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4 bg-grid-paper">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 text-brown-500 hover:text-brown-700 mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>

        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <img src="/images/image.png" alt="Durable Schools" className="w-12 h-12 rounded-xl object-cover" />
            <div>
              <h1 className="font-display text-xl font-bold text-brown-800">Durable Schools</h1>
              <p className="text-sm text-brown-400">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</p>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2 p-1 bg-cream-200 rounded-lg mb-6">
            <button
              className={cn('flex-1 py-2 rounded-md text-sm font-medium transition-all', mode === 'signin' ? 'bg-cream-50 text-brown-700 shadow-sm' : 'text-brown-400')}
              onClick={() => setMode('signin')}
            >
              Sign In
            </button>
            <button
              className={cn('flex-1 py-2 rounded-md text-sm font-medium transition-all', mode === 'signup' ? 'bg-cream-50 text-brown-700 shadow-sm' : 'text-brown-400')}
              onClick={() => { setMode('signup'); setStep(1) }}
            >
              Sign Up
            </button>
          </div>

          {mode === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-brown-300" />
                  <input type="email" required value={signInEmail} onChange={(e) => setSignInEmail(e.target.value)} className="input pl-10" placeholder="you@school.com" />
                </div>
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-brown-300" />
                  <input type="password" required value={signInPassword} onChange={(e) => setSignInPassword(e.target.value)} className="input pl-10" placeholder="••••••••" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary w-full">
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4">
              {/* Step 1: Role selection */}
              {step === 1 && (
                <>
                  <div>
                    <label className="label">I am a...</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 'admin', label: 'School Admin', desc: 'Manage a branch' },
                        { value: 'teacher', label: 'Teacher', desc: 'Join a school' },
                        { value: 'parent', label: 'Parent', desc: 'Monitor children' }
                      ].map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setRole(r.value as typeof role)}
                          className={cn(
                            'p-4 rounded-lg border-2 text-left transition-all',
                            role === r.value ? 'border-brown-600 bg-brown-50' : 'border-cream-400 hover:border-brown-300'
                          )}
                        >
                          <p className="font-semibold text-brown-700 text-sm">{r.label}</p>
                          <p className="text-xs text-brown-400 mt-1">{r.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="button" className="btn btn-primary w-full" onClick={() => setStep(2)}>
                    Continue
                  </button>
                </>
              )}

              {/* Step 2: Details */}
              {step === 2 && (
                <>
                  {role === 'admin' && (
                    <div>
                      <label className="label">Which branch are you registering as Admin for?</label>
                      <div className="grid grid-cols-1 gap-3">
                        {[
                          { value: 'DFS-PRIMARY', label: 'Durable Foundation School', desc: 'Primary' },
                          { value: 'DCHS-SECONDARY', label: 'Durable Comprehensive High School', desc: 'Secondary' }
                        ].map((b) => (
                          <button
                            key={b.value}
                            type="button"
                            onClick={() => setBranch(b.value as typeof branch)}
                            className={cn(
                              'p-4 rounded-lg border-2 text-left transition-all flex items-center gap-3',
                              branch === b.value ? 'border-brown-600 bg-brown-50' : 'border-cream-400 hover:border-brown-300'
                            )}
                          >
                            <School className="w-5 h-5 text-brown-400" />
                            <div>
                              <p className="font-semibold text-brown-700 text-sm">{b.label}</p>
                              <p className="text-xs text-brown-400">{b.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="mt-3">
                        <label className="label">Admin Invite Code</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 w-5 h-5 text-brown-300" />
                          <input required value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} className="input pl-10" placeholder="Provided separately by the school" />
                        </div>
                        <p className="text-xs text-brown-400 mt-1">This is different from the School Code — ask whoever set up the platform.</p>
                      </div>
                    </div>
                  )}

                  {role !== 'admin' && (
                    <div>
                      <label className="label">School Code</label>
                      <input required value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} className="input" placeholder="e.g. DFS-PRIMARY" />
                      <p className="text-xs text-brown-400 mt-1">Ask your school administrator for your branch's code.</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">First Name</label>
                      <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" placeholder="First name" />
                    </div>
                    <div>
                      <label className="label">Last Name</label>
                      <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" placeholder="Last name" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-5 h-5 text-brown-300" />
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input pl-10" placeholder="you@email.com" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Phone (optional)</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-5 h-5 text-brown-300" />
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input pl-10" placeholder="080..." />
                    </div>
                  </div>
                  <div>
                    <label className="label">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-5 h-5 text-brown-300" />
                      <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="input pl-10" placeholder="At least 6 characters" />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button type="button" className="btn btn-ghost flex-1" onClick={() => setStep(1)}>Back</button>
                    <button type="submit" disabled={loading} className="btn btn-primary flex-1">
                      {loading ? 'Creating...' : 'Create Account'}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
