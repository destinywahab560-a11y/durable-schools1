import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, signUpWithoutSessionSwap } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Modal, Spinner, EmptyState } from '@/components/ui'
import { getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'
import Papa from 'papaparse'
import { Users, Plus, Mail, Trash2, Upload, Download } from 'lucide-react'

export default function AdminStaff() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '', class_id: '', subject_id: '' })

  const { data: classes } = useQuery({
    queryKey: ['classes', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('*').eq('school_id', schoolId).order('name')
      return data ?? []
    },
    enabled: !!schoolId
  })

  const { data: subjects } = useQuery({
    queryKey: ['subjects', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('subjects').select('*').eq('school_id', schoolId).order('name')
      return data ?? []
    },
    enabled: !!schoolId
  })

  const { data: classSubjectLinks } = useQuery({
    queryKey: ['class-subjects-links', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('class_subjects')
        .select('class_id, subject_id')
        .in('class_id', (classes ?? []).map((c) => c.id))
      return data ?? []
    },
    enabled: !!classes && classes.length > 0
  })

  const subjectsForClass = (classId: string) => {
    if (!classId) return subjects ?? []
    const validSubjectIds = new Set((classSubjectLinks ?? []).filter((l) => l.class_id === classId).map((l) => l.subject_id))
    return (subjects ?? []).filter((s) => validSubjectIds.has(s.id))
  }

  const { data: staff, isLoading } = useQuery({
    queryKey: ['staff', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('school_id', schoolId)
        .in('role', ['teacher', 'admin'])
        .order('created_at', { ascending: false })
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
        { role: 'teacher', first_name: form.first_name, last_name: form.last_name }
      )
      if (authError) throw authError
      if (!authData.user) throw new Error('Failed to create user')

      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        school_id: schoolId,
        role: 'teacher',
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone || null
      })
      if (profileError) throw profileError

      if (form.class_id && form.subject_id) {
        const { error: assignError } = await supabase.from('teacher_assignments').insert({
          teacher_id: authData.user.id,
          class_id: form.class_id,
          subject_id: form.subject_id,
          status: 'approved'
        })
        if (assignError) throw assignError

        const cls = classes?.find((c) => c.id === form.class_id)
        const subj = subjects?.find((s) => s.id === form.subject_id)
        const { error: classroomError } = await supabase.from('classrooms').insert({
          school_id: schoolId,
          class_id: form.class_id,
          subject_id: form.subject_id,
          teacher_id: authData.user.id,
          name: `${subj?.name} — ${cls?.name}${cls?.arm}`
        })
        if (classroomError && !classroomError.message.includes('duplicate')) throw classroomError
      }

      toast.success(form.class_id ? 'Teacher account created and assigned' : 'Teacher account created')
      setModalOpen(false)
      setForm({ first_name: '', last_name: '', email: '', phone: '', password: '', class_id: '', subject_id: '' })
      queryClient.invalidateQueries({ queryKey: ['staff', schoolId] })
    } catch (err) {
      console.error('Add teacher error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to create teacher')
    }
  }

  const generateTempPassword = () => Math.random().toString(36).slice(-4) + Math.random().toString(36).slice(-4).toUpperCase()

  type BulkRow = { first_name: string; last_name: string; email: string; phone: string; class_id: string; subject_id: string }
  type BulkResult = { first_name: string; last_name: string; email: string; password: string; assigned: boolean; success: boolean; error?: string }

  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([{ first_name: '', last_name: '', email: '', phone: '', class_id: '', subject_id: '' }])
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)

  const addBulkRow = () => setBulkRows((prev) => [...prev, { first_name: '', last_name: '', email: '', phone: '', class_id: '', subject_id: '' }])
  const removeBulkRow = (index: number) => setBulkRows((prev) => prev.filter((_, i) => i !== index))
  const updateBulkRow = (index: number, field: keyof BulkRow, value: string) => {
    setBulkRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const findClassByName = (name: string) => {
    const norm = name.trim().toLowerCase()
    return classes?.find((c) => `${c.name} ${c.arm}`.trim().toLowerCase() === norm || c.name.toLowerCase() === norm)
  }
  const findSubjectByName = (name: string) => subjects?.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase())

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
          .map((r) => {
            const matchedClass = r.class ? findClassByName(r.class) : undefined
            const rawMatchedSubject = r.subject ? findSubjectByName(r.subject) : undefined
            const validSubjectIds = new Set(matchedClass ? subjectsForClass(matchedClass.id).map((s) => s.id) : [])
            const matchedSubject = rawMatchedSubject && validSubjectIds.has(rawMatchedSubject.id) ? rawMatchedSubject : undefined
            return {
              first_name: r.first_name || '',
              last_name: r.last_name || '',
              email: r.email || '',
              phone: r.phone || '',
              class_id: matchedClass?.id || '',
              subject_id: matchedSubject?.id || ''
            }
          })
        if (parsed.length === 0) {
          toast.error('No valid rows found — check the CSV has first_name, last_name, email columns.')
          return
        }
        const unmatchedCount = parsed.filter((r, i) => (results.data as any[])[i]?.class && !r.class_id).length
        setBulkRows((prev) => {
          const cleaned = prev.filter((r) => r.first_name || r.last_name || r.email)
          return [...cleaned, ...parsed]
        })
        toast.success(`${parsed.length} row(s) added from CSV${unmatchedCount > 0 ? ` — ${unmatchedCount} class name(s) didn't match, pick those manually` : ''}`)
      },
      error: (err) => toast.error(`Couldn't read that file: ${err.message}`)
    })
    e.target.value = ''
  }

  const downloadCsvTemplate = () => {
    const csv = 'first_name,last_name,email,phone,class,subject\nJane,Smith,jane.smith@example.com,08012345678,Primary 1 A,Mathematics\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'teacher_bulk_add_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleBulkAdd = async () => {
    const validRows = bulkRows.filter((r) => r.first_name && r.last_name && r.email)
    if (validRows.length === 0) { toast.error('Add at least one teacher with a first name, last name, and email.'); return }

    setBulkSubmitting(true)
    const results: BulkResult[] = []

    for (const row of validRows) {
      const password = generateTempPassword()
      try {
        const { data: authData, error: authError } = await signUpWithoutSessionSwap(
          row.email, password, { role: 'teacher', first_name: row.first_name, last_name: row.last_name }
        )
        if (authError) throw authError
        if (!authData.user) throw new Error('Account creation failed')

        const { error: profileError } = await supabase.from('profiles').insert({
          id: authData.user.id, school_id: schoolId, role: 'teacher',
          first_name: row.first_name, last_name: row.last_name, email: row.email, phone: row.phone || null
        })
        if (profileError) throw profileError

        let assigned = false
        if (row.class_id && row.subject_id) {
          const { error: assignError } = await supabase.from('teacher_assignments').insert({
            teacher_id: authData.user.id, class_id: row.class_id, subject_id: row.subject_id, status: 'approved'
          })
          if (assignError) throw assignError

          const cls = classes?.find((c) => c.id === row.class_id)
          const subj = subjects?.find((s) => s.id === row.subject_id)
          const { error: classroomError } = await supabase.from('classrooms').insert({
            school_id: schoolId, class_id: row.class_id, subject_id: row.subject_id, teacher_id: authData.user.id,
            name: `${subj?.name} — ${cls?.name}${cls?.arm}`
          })
          if (classroomError && !classroomError.message.includes('duplicate')) throw classroomError
          assigned = true
        }

        results.push({ first_name: row.first_name, last_name: row.last_name, email: row.email, password, assigned, success: true })
      } catch (err) {
        results.push({
          first_name: row.first_name, last_name: row.last_name, email: row.email, password, assigned: false,
          success: false, error: err instanceof Error ? err.message : 'Failed'
        })
      }
    }

    setBulkResults(results)
    setBulkSubmitting(false)
    queryClient.invalidateQueries({ queryKey: ['staff', schoolId] })
  }

  const closeBulkModal = () => {
    setBulkModalOpen(false)
    setBulkRows([{ first_name: '', last_name: '', email: '', phone: '', class_id: '', subject_id: '' }])
    setBulkResults(null)
  }

  const handleDeactivate = async (id: string) => {
    const { error } = await supabase.from('profiles').update({ is_active: false }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Staff deactivated')
    queryClient.invalidateQueries({ queryKey: ['staff', schoolId] })
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="Staff Management" subtitle="Manage teachers and admin accounts"
        action={
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={() => setBulkModalOpen(true)}><Users className="w-4 h-4" /> Bulk Add Teachers</button>
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Add Teacher</button>
          </div>
        } />

      {staff && staff.length > 0 ? (
        <div className="space-y-3">
          {staff.map((s) => (
            <div key={s.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-brown-600 text-cream-100 flex items-center justify-center font-semibold">
                  {getInitials(`${s.first_name} ${s.last_name}`)}
                </div>
                <div>
                  <p className="font-semibold text-brown-800">{s.first_name} {s.last_name}</p>
                  <p className="text-sm text-brown-400">{s.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${s.role === 'admin' ? 'badge-amber' : 'badge-brown'}`}>{s.role}</span>
                {s.is_active ? <span className="badge badge-sage">Active</span> : <span className="badge badge-error">Inactive</span>}
                {s.role !== 'admin' && (
                  <button onClick={() => handleDeactivate(s.id)} className="p-2 rounded-lg hover:bg-error-50 text-error-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Users} title="No staff yet" description="Add your first teacher account."
          action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Add Teacher</button>} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Teacher">
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
          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-brown-300" />
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input pl-10" />
            </div>
          </div>
          <div>
            <label className="label">Phone (optional)</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" placeholder="080..." />
          </div>
          <div>
            <label className="label">Temporary Password</label>
            <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Class (optional)</label>
              <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value, subject_id: '' })} className="input">
                <option value="">No class yet</option>
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.arm}{c.stream ? ` (${c.stream})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Subject (optional)</label>
              <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} className="input" disabled={!form.class_id}>
                <option value="">{form.class_id ? 'No subject yet' : 'Pick a class first'}</option>
                {subjectsForClass(form.class_id).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-brown-400 -mt-2">
            Assigning a class + subject now creates it as already-approved. They can request additional classes later from their own dashboard.
          </p>
          <button type="submit" className="btn btn-primary w-full">Create Teacher Account</button>
        </form>
      </Modal>

      <Modal open={bulkModalOpen} onClose={closeBulkModal} title="Bulk Add Teachers" size="xl">
        {bulkResults ? (
          <div className="space-y-4">
            <p className="text-sm text-brown-600">
              {bulkResults.filter((r) => r.success).length} of {bulkResults.length} teachers added.
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
                        <p className="text-sm text-brown-600 mt-1">
                          Password: <span className="font-mono">{r.password}</span>
                          {!r.assigned && ' • No class assigned yet'}
                        </p>
                      ) : (
                        <p className="text-sm text-error-600 mt-1">{r.error}</p>
                      )}
                    </div>
                    <span className={`badge ${r.success ? 'badge-sage' : 'badge-error'}`}>{r.success ? 'Added' : 'Failed'}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-brown-400">Copy down the passwords above before closing — they aren't stored anywhere retrievable afterward.</p>
            <button className="btn btn-primary w-full" onClick={closeBulkModal}>Done</button>
          </div>
        ) : (
          <div className="space-y-4">
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
                  <input placeholder="Email" type="email" value={row.email} onChange={(e) => updateBulkRow(i, 'email', e.target.value)} className="input col-span-3 text-sm" />
                  <select value={row.class_id} onChange={(e) => updateBulkRow(i, 'class_id', e.target.value)} className="input col-span-2 text-sm">
                    <option value="">No class</option>
                    {classes?.map((c) => <option key={c.id} value={c.id}>{c.name} {c.arm}{c.stream ? ` (${c.stream})` : ''}</option>)}
                  </select>
                  <select value={row.subject_id} onChange={(e) => updateBulkRow(i, 'subject_id', e.target.value)} className="input col-span-2 text-sm" disabled={!row.class_id}>
                    <option value="">{row.class_id ? 'No subject' : 'Pick class first'}</option>
                    {subjectsForClass(row.class_id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
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
              Temporary passwords are generated automatically for each teacher — you'll see them in a summary after adding.
              Class/Subject are optional per teacher — leave blank if they'll request assignments themselves later.
            </p>

            <button type="button" className="btn btn-primary w-full" onClick={handleBulkAdd} disabled={bulkSubmitting}>
              {bulkSubmitting ? 'Adding...' : `Add All (${bulkRows.filter((r) => r.first_name && r.last_name && r.email).length})`}
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
