import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Modal, Spinner, EmptyState } from '@/components/ui'
import toast from 'react-hot-toast'
import { BookOpen, Plus, Trash2 } from 'lucide-react'

export default function AdminSubjects() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  const { data: subjects, isLoading } = useQuery({
    queryKey: ['subjects', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('subjects').select('*').eq('school_id', schoolId).order('name')
      return data ?? []
    },
    enabled: !!schoolId
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('subjects').insert({ school_id: schoolId, name, code: code || null })
    if (error) { toast.error(error.message); return }
    toast.success('Subject created')
    setModalOpen(false); setName(''); setCode('')
    queryClient.invalidateQueries({ queryKey: ['subjects', schoolId] })
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('subjects').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Subject deleted')
    queryClient.invalidateQueries({ queryKey: ['subjects', schoolId] })
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="Subjects" subtitle="Manage your school's subject list"
        action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Add Subject</button>} />

      {subjects && subjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((s) => (
            <div key={s.id} className="card flex items-center justify-between">
              <div>
                <p className="font-semibold text-brown-800">{s.name}</p>
                {s.code && <p className="text-sm text-brown-400">{s.code}</p>}
              </div>
              <button onClick={() => handleDelete(s.id)} className="p-2 rounded-lg hover:bg-error-50 text-error-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={BookOpen} title="No subjects yet" description="Add subjects to map them to classes."
          action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Add Subject</button>} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Subject">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Subject Name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g. Mathematics" />
          </div>
          <div>
            <label className="label">Subject Code (optional)</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className="input" placeholder="e.g. MTH101" />
          </div>
          <button type="submit" className="btn btn-primary w-full">Create Subject</button>
        </form>
      </Modal>
    </div>
  )
}
