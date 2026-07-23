import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Modal, Spinner, EmptyState, ConfirmDialog } from '@/components/ui'
import { NIGERIAN_CLASSES, SS_STREAMS } from '@/lib/utils'
import toast from 'react-hot-toast'
import { School, Plus, Trash2 } from 'lucide-react'

export default function AdminClasses() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', arm: 'A', stream: '' })

  const { data: classes, isLoading } = useQuery({
    queryKey: ['classes', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('*').eq('school_id', schoolId).order('name')
      return data ?? []
    },
    enabled: !!schoolId
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const level = form.name
    const isSS = level.startsWith('SS')
    const { error } = await supabase.from('classes').insert({
      school_id: schoolId,
      name: form.name,
      level: level,
      arm: form.arm,
      stream: isSS && form.stream ? form.stream : null
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Class created')
      setModalOpen(false)
      setForm({ name: '', arm: 'A', stream: '' })
      queryClient.invalidateQueries({ queryKey: ['classes', schoolId] })
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const { error } = await supabase.from('classes').delete().eq('id', deleteId)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Class deleted')
      queryClient.invalidateQueries({ queryKey: ['classes', schoolId] })
    }
    setDeleteId(null)
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Classes & Arms"
        subtitle="Configure your school's class structure"
        action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Add Class</button>}
      />

      {classes && classes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((c) => (
            <div key={c.id} className="card flex items-center justify-between">
              <div>
                <p className="font-semibold text-brown-800">{c.name} {c.arm}</p>
                {c.stream && <span className="badge badge-amber mt-1">{c.stream}</span>}
              </div>
              <button onClick={() => setDeleteId(c.id)} className="p-2 rounded-lg hover:bg-error-50 text-error-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={School} title="No classes yet" description="Add your first class to get started." action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Add Class</button>} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Class">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Class Name</label>
            <select required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input">
              <option value="">Select class...</option>
              {NIGERIAN_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Arm / Section</label>
            <input required value={form.arm} onChange={(e) => setForm({ ...form, arm: e.target.value })} className="input" placeholder="e.g. A, B, C" />
          </div>
          {form.name.startsWith('SS') && (
            <div>
              <label className="label">Stream (SS only)</label>
              <select value={form.stream} onChange={(e) => setForm({ ...form, stream: e.target.value })} className="input">
                <option value="">No stream</option>
                {SS_STREAMS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <button type="submit" className="btn btn-primary w-full">Create Class</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Class"
        message="This will remove the class and all its subject mappings. This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
