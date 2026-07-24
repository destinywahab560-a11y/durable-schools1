import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, signUpWithoutSessionSwap } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Modal, Spinner, EmptyState } from '@/components/ui'
import { getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Users, Plus, Mail, Trash2 } from 'lucide-react'

export default function AdminStaff() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '' })

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

      toast.success('Teacher account created')
      setModalOpen(false)
      setForm({ first_name: '', last_name: '', email: '', phone: '', password: '' })
      queryClient.invalidateQueries({ queryKey: ['staff', schoolId] })
    } catch (err) {
      console.error('Add teacher error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to create teacher')
    }
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
        action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Add Teacher</button>} />

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
          <button type="submit" className="btn btn-primary w-full">Create Teacher Account</button>
        </form>
      </Modal>
    </div>
  )
}
