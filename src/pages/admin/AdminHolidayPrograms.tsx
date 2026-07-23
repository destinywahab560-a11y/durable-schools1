import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Modal, Spinner, EmptyState } from '@/components/ui'
import { formatDate, formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Sun, Plus, Users } from 'lucide-react'

export default function AdminHolidayPrograms() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', start_date: '', end_date: '', fee_amount: '' })

  const { data: programs, isLoading } = useQuery({
    queryKey: ['holiday-programs', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('holiday_programs').select('*').eq('school_id', schoolId).order('start_date', { ascending: false })
      return data ?? []
    },
    enabled: !!schoolId
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('holiday_programs').insert({
      school_id: schoolId,
      name: form.name,
      description: form.description || null,
      start_date: form.start_date,
      end_date: form.end_date,
      fee_amount: parseFloat(form.fee_amount) || 0
    })
    if (error) { toast.error(error.message); return }
    toast.success('Holiday program created')
    setModalOpen(false)
    setForm({ name: '', description: '', start_date: '', end_date: '', fee_amount: '' })
    queryClient.invalidateQueries({ queryKey: ['holiday-programs', schoolId] })
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="Holiday Programs" subtitle="Manage summer and holiday lesson programmes"
        action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Add Program</button>} />

      {programs && programs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {programs.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Sun className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-brown-800">{p.name}</p>
                    <p className="text-sm text-brown-400">{formatDate(p.start_date)} → {formatDate(p.end_date)}</p>
                  </div>
                </div>
                <p className="text-lg font-bold text-brown-700">{formatCurrency(p.fee_amount)}</p>
              </div>
              {p.description && <p className="text-sm text-brown-500">{p.description}</p>}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Sun} title="No holiday programs yet" description="Create summer or holiday lesson programs."
          action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Add Program</button>} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Holiday Program">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Program Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="e.g. Summer Coaching 2025" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Date</label>
              <input type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">End Date</label>
              <input type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Fee Amount (₦)</label>
            <input type="number" value={form.fee_amount} onChange={(e) => setForm({ ...form, fee_amount: e.target.value })} className="input" placeholder="0" />
          </div>
          <button type="submit" className="btn btn-primary w-full">Create Program</button>
        </form>
      </Modal>
    </div>
  )
}
