import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Modal, Spinner, EmptyState } from '@/components/ui'
import { TERM_NAMES, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Calendar, Plus, CheckCircle2 } from 'lucide-react'

export default function AdminSessions() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ session_name: '', term: 'First Term', start_date: '', end_date: '' })

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('academic_sessions').select('*').eq('school_id', schoolId).order('start_date', { ascending: false })
      return data ?? []
    },
    enabled: !!schoolId
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('academic_sessions').insert({ school_id: schoolId, ...form })
    if (error) { toast.error(error.message); return }
    toast.success('Session created')
    setModalOpen(false)
    setForm({ session_name: '', term: 'First Term', start_date: '', end_date: '' })
    queryClient.invalidateQueries({ queryKey: ['sessions', schoolId] })
  }

  const setCurrent = async (id: string) => {
    await supabase.from('academic_sessions').update({ is_current: false }).eq('school_id', schoolId)
    const { error } = await supabase.from('academic_sessions').update({ is_current: true }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Current term updated')
    queryClient.invalidateQueries({ queryKey: ['sessions', schoolId] })
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="Sessions & Terms" subtitle="Manage academic sessions and terms"
        action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Add Session</button>} />

      {sessions && sessions.length > 0 ? (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-brown-100 text-brown-600 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-brown-800">{s.session_name} — {s.term}</p>
                  <p className="text-sm text-brown-400">{formatDate(s.start_date)} → {formatDate(s.end_date)}</p>
                </div>
              </div>
              {s.is_current ? (
                <span className="badge badge-sage"><CheckCircle2 className="w-3 h-3 mr-1" /> Current</span>
              ) : (
                <button className="btn btn-ghost text-sm" onClick={() => setCurrent(s.id)}>Set as Current</button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Calendar} title="No sessions yet" description="Create your first academic session."
          action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Add Session</button>} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Session">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Session Name</label>
            <input required value={form.session_name} onChange={(e) => setForm({ ...form, session_name: e.target.value })} className="input" placeholder="e.g. 2025/2026" />
          </div>
          <div>
            <label className="label">Term</label>
            <select value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} className="input">
              {TERM_NAMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
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
          <button type="submit" className="btn btn-primary w-full">Create Session</button>
        </form>
      </Modal>
    </div>
  )
}
