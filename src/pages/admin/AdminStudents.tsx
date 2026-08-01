import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, signUpWithoutSessionSwap } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Modal, Spinner, EmptyState, ConfirmDialog } from '@/components/ui'
import { getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'
import Papa from 'papaparse'
import { GraduationCap, Plus, Mail, Users, Trash2, Upload, Download, RotateCcw } from 'lucide-react'

export default function AdminStudents() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', password: '',
    admission_number: '', class_id: ''
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

      const { data: session } = await supabase
        .from('academic_sessions').select('id').eq('school_id', schoolId).eq('is_current', true).maybeSingle()
      if (!session) throw new Error('No current academic session is set. Go to Sessions & Terms and mark one as current before enrolling students.')

      const { error: enrollError } = await supabase.from('student_enrollments').insert({
        student_id: authData.user.id,
        class_id: form.class_id,
        session_id: session.id,
        admission_number: form.admission_number || null
      })
      if (enrollError) throw enrollError

      toast.success('Student enrolled')
      setModalOpen(false)
      setForm({ first_name: '', last_name: '', email: '', phone: '', password: '', admission_number: '', class_id: '' })
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

  const generateNextAdmissionNumber = async (offset = 0) => {
    if (!school?.code || !classes) return null
    const prefix = school.code.split('-')[0]
    const { count } = await supabase
      .from('student_enrollments')
      .select('id', { count: 'exact', head: true })
      .in('class_id', classes.map((c) => c.id))
    const nextNumber = (count ?? 0) + 1 + offset
    return `${prefix}-${String(nextNumber).padStart(4, '0')}`
  }

  const generateTempPassword = () => Math.random().toString(36).slice(-4) + Math.random().toString(36).slice(-4).toUpperCase()

  type BulkRow = { first_name: string; last_name: string; email: string; phone: string }
  type BulkResult = { first_name: string; last_name: string; email: string; admission_number: string; password: string; success: boolean; error?: string }

  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkClassId, setBulkClassId] = useState('')
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([{ first_name: '', last_name: '', email: '', phone: '' }])
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)

  const addBulkRow = () => setBulkRows((prev) => [...prev, { first_name: '', last_name: '', email: '', phone: '' }])
  const removeBulkRow = (index: number) => setBulkRows((prev) => prev.filter((_, i) => i !== index))
  const updateBulkRow = (index: number, field: keyof BulkRow, value: string) => {
    setBulkRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: (results) => {
        const parsed = (results.data as any[])
          .filter((r) => r.first_name || r.last_name || r.email)
          .map((r) => ({
            first_name: r.first_name || '',
            last_name: r.last_name || '',
            email: r.email || '',
            phone: r.phone || ''
          }))
        if (parsed.length === 0) {
          toast.error('No valid rows found — check the CSV has first_name, last_name, email columns.')
          return
        }
        setBulkRows((prev) => {
          const cleaned = prev.filter((r) => r.first_name || r.last_name || r.email)
          return [...cleaned, ...parsed]
        })
        toast.success(`${parsed.length} row(s) added from CSV`)
      },
      error: (err) => toast.error(`Couldn't read that file: ${err.message}`)
    })
    e.target.value = ''
  }

  const downloadCsvTemplate = () => {
    const csv = 'first_name,last_name,email,phone\nJohn,Doe,john.doe@example.com,08012345678\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'student_bulk_enroll_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleBulkEnroll = async () => {
    const validRows = bulkRows.filter((r) => r.first_name && r.last_name && r.email)
    if (!bulkClassId) { toast.error('Pick a class for this batch first.'); return }
    if (validRows.length === 0) { toast.error('Add at least one student with a first name, last name, and email.'); return }

    const { data: session } = await supabase
      .from('academic_sessions').select('id').eq('school_id', schoolId).eq('is_current', true).maybeSingle()
    if (!session) { toast.error('No current academic session is set. Go to Sessions & Terms and mark one as current first.'); return }

    setBulkSubmitting(true)
    const results: BulkResult[] = []

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]
      const password = generateTempPassword()
      const admissionNumber = (await generateNextAdmissionNumber(i)) ?? ''
      try {
        const { data: authData, error: authError } = await signUpWithoutSessionSwap(
          row.email, password, { role: 'student', first_name: row.first_name, last_name: row.last_name }
        )
        if (authError) throw authError
        if (!authData.user) throw new Error('Account creation failed')

        const { error: profileError } = await supabase.from('profiles').insert({
          id: authData.user.id, school_id: schoolId, role: 'student',
          first_name: row.first_name, last_name: row.last_name, email: row.email, phone: row.phone || null
        })
        if (profileError) throw profileError

        const { error: enrollError } = await supabase.from('student_enrollments').insert({
          student_id: authData.user.id, class_id: bulkClassId, session_id: session.id,
          admission_number: admissionNumber || null
        })
        if (enrollError) throw enrollError

        results.push({ first_name: row.first_name, last_name: row.last_name, email: row.email, admission_number: admissionNumber, password, success: true })
      } catch (err) {
        results.push({
          first_name: row.first_name, last_name: row.last_name, email: row.email, admission_number: admissionNumber, password,
          success: false, error: err instanceof Error ? err.message : 'Failed'
        })
      }
    }

    setBulkResults(results)
    setBulkSubmitting(false)
    queryClient.invalidateQueries({ queryKey: ['students', schoolId] })
  }

  const closeBulkModal = () => {
    setBulkModalOpen(false)
    setBulkClassId('')
    setBulkRows([{ first_name: '', last_name: '', email: '', phone: '' }])
    setBulkResults(null)
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

  const [toggleActiveTarget, setToggleActiveTarget] = useState<{ id: string; name: string; isActive: boolean } | null>(null)
  const handleToggleActive = async () => {
    if (!toggleActiveTarget) return
    const { error } = await supabase.from('profiles').update({ is_active: !toggleActiveTarget.isActive }).eq('id', toggleActiveTarget.id)
    if (error) { toast.error(error.message); setToggleActiveTarget(null); return }
    toast.success(toggleActiveTarget.isActive ? 'Student deactivated' : 'Student reactivated')
    setToggleActiveTarget(null)
    queryClient.invalidateQueries({ queryKey: ['students', schoolId] })
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="Students" subtitle="Enroll and manage student accounts"
        action={
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={() => setBulkModalOpen(true)}><Users className="w-4 h-4" /> Bulk Enroll</button>
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Enroll Student</button>
          </div>
        } />

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
                <button
                  onClick={() => setToggleActiveTarget({ id: s.id, name: `${s.first_name} ${s.last_name}`, isActive: s.is_active })}
                  className="p-2 rounded-lg hover:bg-error-50 text-error-500"
                  aria-label={s.is_active ? 'Deactivate student' : 'Reactivate student'}
                >
                  {s.is_active ? <Trash2 className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                </button>
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
          <button type="submit" className="btn btn-primary w-full">Enroll Student</button>
        </form>
      </Modal>

      <Modal open={bulkModalOpen} onClose={closeBulkModal} title="Bulk Enroll Students" size="xl">
        {bulkResults ? (
          <div className="space-y-4">
            <p className="text-sm text-brown-600">
              {bulkResults.filter((r) => r.success).length} of {bulkResults.length} students enrolled.
              {bulkResults.some((r) => !r.success) && ' Check the failed rows below and try them again individually.'}
            </p>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {bulkResults.map((r, i) => (
                <div key={i} className={`p-3 rounded-lg border ${r.success ? 'border-sage-200 bg-sage-50' : 'border-error-200 bg-error-50'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-brown-800">{r.first_name} {r.last_name}</p>
                      <p className="text-sm text-brown-500">{r.email}</p>
                      {r.success ? (
                        <p className="text-sm text-brown-600 mt-1">Adm: <span className="font-mono">{r.admission_number}</span> • Password: <span className="font-mono">{r.password}</span></p>
                      ) : (
                        <p className="text-sm text-error-600 mt-1">{r.error}</p>
                      )}
                    </div>
                    <span className={`badge ${r.success ? 'badge-sage' : 'badge-error'}`}>{r.success ? 'Enrolled' : 'Failed'}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-brown-400">Copy down the passwords above before closing — they aren't stored anywhere retrievable afterward.</p>
            <button className="btn btn-primary w-full" onClick={closeBulkModal}>Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="label">Class for this batch</label>
              <select required value={bulkClassId} onChange={(e) => setBulkClassId(e.target.value)} className="input">
                <option value="">Select class...</option>
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.arm}{c.stream ? ` (${c.stream})` : ''}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <label className="btn btn-secondary text-sm cursor-pointer">
                <Upload className="w-4 h-4" /> Upload CSV
                <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
              </label>
              <button type="button" className="btn btn-ghost text-sm" onClick={downloadCsvTemplate}>
                <Download className="w-4 h-4" /> Download Template
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {bulkRows.map((row, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-cream-100">
                  <input placeholder="First name" value={row.first_name} onChange={(e) => updateBulkRow(i, 'first_name', e.target.value)} className="input col-span-2 text-sm" />
                  <input placeholder="Last name" value={row.last_name} onChange={(e) => updateBulkRow(i, 'last_name', e.target.value)} className="input col-span-2 text-sm" />
                  <input placeholder="Email" type="email" value={row.email} onChange={(e) => updateBulkRow(i, 'email', e.target.value)} className="input col-span-4 text-sm" />
                  <input placeholder="Phone (opt.)" value={row.phone} onChange={(e) => updateBulkRow(i, 'phone', e.target.value)} className="input col-span-3 text-sm" />
                  <button type="button" onClick={() => removeBulkRow(i)} className="col-span-1 p-2 rounded-lg hover:bg-error-50 text-error-500" aria-label="Remove row">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button type="button" className="btn btn-ghost text-sm" onClick={addBulkRow}>
              <Plus className="w-4 h-4" /> Add Row
            </button>

            <p className="text-xs text-brown-400">
              Admission numbers and temporary passwords are generated automatically for each student — you'll see them in a summary after enrolling.
            </p>

            <button type="button" className="btn btn-primary w-full" onClick={handleBulkEnroll} disabled={bulkSubmitting}>
              {bulkSubmitting ? 'Enrolling...' : `Enroll All (${bulkRows.filter((r) => r.first_name && r.last_name && r.email).length})`}
            </button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toggleActiveTarget}
        onClose={() => setToggleActiveTarget(null)}
        onConfirm={handleToggleActive}
        title={toggleActiveTarget?.isActive ? 'Deactivate Student' : 'Reactivate Student'}
        message={
          toggleActiveTarget?.isActive
            ? `${toggleActiveTarget?.name} will lose access to their account. Their grades, attendance, and records are kept — this is reversible, not a permanent delete.`
            : `${toggleActiveTarget?.name} will regain access to their account.`
        }
        confirmLabel={toggleActiveTarget?.isActive ? 'Deactivate' : 'Reactivate'}
        danger={toggleActiveTarget?.isActive}
      />
    </div>
  )
}
