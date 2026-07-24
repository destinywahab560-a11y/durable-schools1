import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, signUpWithoutSessionSwap } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Modal, Spinner, EmptyState } from '@/components/ui'
import { getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'
import { GraduationCap, Plus, Mail } from 'lucide-react'

export default function AdminStudents() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', password: '',
    admission_number: '', class_id: '', parent_email: ''
  })

  const { data: school } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('schools').select('code').eq('id', schoolId).maybeSingle()
      return data
    },
    enabled: !!schoolId
  })

  const { data: classes } = useQuery({
    queryKey: ['classes', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('*').eq('school_id', schoolId).order('name')
      return data ?? []
    },
    enabled: !!schoolId
  })

  const { data: students, isLoading } = useQuery({
    queryKey: ['students', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, first_name, last_name, email, phone, is_active,
          enrollments:student_enrollments!student_id(
            id, admission_number, parent_id,
            class:classes(name, arm, stream)
          )
        `)
        .eq('school_id', schoolId)
        .eq('role', 'student')
        .order('created_at', { ascending: false })
      if (error) {
        console.error('Fetch students error:', error)
        throw error
      }
      return data ?? []
    },
    enabled: !!schoolId
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { data: authData, error: authError } = await signUpWithoutSessionSwap(
        form.email,
        form.password,
        { role: 'student', first_name: form.first_name, last_name: form.last_name }
      )
      if (authError) throw authError
      if (!authData.user) throw new Error('Failed to create user')

      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        school_id: schoolId,
        role: 'student',
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone || null
      })
      if (profileError) throw profileError

      let parentId: string | null = null
      if (form.parent_email) {
        const { data: parent } = await supabase
          .from('profiles').select('id').eq('email', form.parent_email).maybeSingle()
        if (parent) parentId = parent.id
      }

      const { data: session } = await supabase
        .from('academic_sessions').select('id').eq('school_id', schoolId).eq('is_current', true).maybeSingle()

      const { error: enrollError } = await supabase.from('student_enrollments').insert({
        student_id: authData.user.id,
        class_id: form.class_id,
        session_id: session?.id ?? null,
        admission_number: form.admission_number || null,
        parent_id: parentId
      })
      if (enrollError) throw enrollError

      toast.success('Student enrolled')
      setModalOpen(false)
      setForm({ first_name: '', last_name: '', email: '', phone: '', password: '', admission_number: '', class_id: '', parent_email: '' })
      queryClient.invalidateQueries({ queryKey: ['students', schoolId] })
    } catch (err) {
      console.error('Enroll student error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to create student')
    }
  }

  const handleClassSelect = async (classId: string) => {
    setForm((prev) => ({ ...prev, class_id: classId }))
    if (!classId || !school?.code || !classes) return

    const prefix = school.code.split('-')[0] // 'DFS' or 'DCHS'
    const { count } = await supabase
      .from('student_enrollments')
      .select('id', { count: 'exact', head: true })
      .in('class_id', classes.map((c) => c.id))

    const nextNumber = (count ?? 0) + 1
    const admissionNumber = `${prefix}-${String(nextNumber).padStart(4, '0')}`
    setForm((prev) => ({ ...prev, class_id: classId, admission_number: admissionNumber }))
  }

  const [linkParentTarget, setLinkParentTarget] = useState<{ enrollmentId: string; studentName: string } | null>(null)
  const [parentEmail, setParentEmail] = useState('')

  const handleLinkParent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!linkParentTarget) return
    try {
      const { data: parent, error: parentErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', parentEmail)
        .eq('role', 'parent')
        .eq('school_id', schoolId)
        .maybeSingle()
      if (parentErr) throw parentErr
      if (!parent) throw new Error('No parent account found with that email on this branch. Have them sign up first, then try again.')

      const { error: updateErr } = await supabase
        .from('student_enrollments')
        .update({ parent_id: parent.id })
        .eq('id', linkParentTarget.enrollmentId)
      if (updateErr) throw updateErr

      toast.success('Parent linked!')
      setLinkParentTarget(null)
      setParentEmail('')
      queryClient.invalidateQueries({ queryKey: ['students', schoolId] })
    } catch (err) {
      console.error('Link parent error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to link parent')
    }
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="Students" subtitle="Enroll and manage student accounts"
        action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Enroll Student</button>} />

      {students && students.length > 0 ? (
        <div className="space-y-3">
          {students.map((s: any) => (
            <div key={s.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-400 text-brown-800 flex items-center justify-center font-semibold">
                  {getInitials(`${s.first_name} ${s.last_name}`)}
                </div>
                <div>
                  <p className="font-semibold text-brown-800">{s.first_name} {s.last_name}</p>
                  <p className="text-sm text-brown-400">
                    {s.enrollments?.[0]?.class?.name} {s.enrollments?.[0]?.class?.arm}
                    {s.enrollments?.[0]?.admission_number ? ` • Adm: ${s.enrollments[0].admission_number}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {s.enrollments?.[0]?.parent_id ? (
                  <span className="badge badge-sage">Parent linked</span>
                ) : (
                  <button
                    className="btn btn-secondary text-sm"
                    onClick={() => setLinkParentTarget({ enrollmentId: s.enrollments?.[0]?.id, studentName: `${s.first_name} ${s.last_name}` })}
                    disabled={!s.enrollments?.[0]?.id}
                  >
                    Link Parent
                  </button>
                )}
                <span className={`badge ${s.is_active ? 'badge-sage' : 'badge-error'}`}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={GraduationCap} title="No students yet" description="Enroll your first student."
          action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Enroll Student</button>} />
      )}

      <Modal open={!!linkParentTarget} onClose={() => { setLinkParentTarget(null); setParentEmail('') }} title="Link Parent">
        <form onSubmit={handleLinkParent} className="space-y-4">
          <p className="text-sm text-brown-500">
            Linking a parent to <span className="font-semibold">{linkParentTarget?.studentName}</span>.
            The parent must already have their own account (Sign Up → Parent) before this will work.
          </p>
          <div>
            <label className="label">Parent's Email</label>
            <input required type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} className="input" placeholder="parent@email.com" />
          </div>
          <button type="submit" className="btn btn-primary w-full">Link Parent</button>
        </form>
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Enroll Student" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First Name</label>
              <input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-brown-300" />
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input pl-10" />
              </div>
            </div>
            <div>
              <label className="label">Phone (optional)</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Temporary Password</label>
            <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Admission Number</label>
              <input value={form.admission_number} onChange={(e) => setForm({ ...form, admission_number: e.target.value })} className="input" placeholder="Auto-fills once a class is picked" />
            </div>
            <div>
              <label className="label">Class</label>
              <select required value={form.class_id} onChange={(e) => handleClassSelect(e.target.value)} className="input">
                <option value="">Select class...</option>
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.arm}{c.stream ? ` (${c.stream})` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Parent Email (optional — to link parent)</label>
            <input type="email" value={form.parent_email} onChange={(e) => setForm({ ...form, parent_email: e.target.value })} className="input" placeholder="parent@email.com" />
          </div>
          <button type="submit" className="btn btn-primary w-full">Enroll Student</button>
        </form>
      </Modal>
    </div>
  )
}
