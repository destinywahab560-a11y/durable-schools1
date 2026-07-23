import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Modal, Spinner, EmptyState } from '@/components/ui'
import toast from 'react-hot-toast'
import { Library, Plus, Search } from 'lucide-react'

export default function AdminResourceBank() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ title: '', description: '', file_url: '', topic: '', resource_type: 'past_question', subject_id: '' })

  const { data: subjects } = useQuery({
    queryKey: ['subjects', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('subjects').select('*').eq('school_id', schoolId).order('name')
      return data ?? []
    },
    enabled: !!schoolId
  })

  const { data: resources, isLoading } = useQuery({
    queryKey: ['resource-bank', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('resource_bank')
        .select('id, title, description, file_url, topic, resource_type, subject:subjects(name)')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!schoolId
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('resource_bank').insert({
      school_id: schoolId,
      title: form.title,
      description: form.description || null,
      file_url: form.file_url || null,
      topic: form.topic || null,
      resource_type: form.resource_type,
      subject_id: form.subject_id || null
    })
    if (error) { toast.error(error.message); return }
    toast.success('Resource added')
    setModalOpen(false)
    setForm({ title: '', description: '', file_url: '', topic: '', resource_type: 'past_question', subject_id: '' })
    queryClient.invalidateQueries({ queryKey: ['resource-bank', schoolId] })
  }

  const filtered = resources?.filter((r: any) =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.topic?.toLowerCase().includes(search.toLowerCase()) ||
    r.subject?.name?.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="Resource Bank" subtitle="Library of past questions and reference materials"
        action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Add Resource</button>} />

      <div className="relative mb-6">
        <Search className="absolute left-3 top-3 w-5 h-5 text-brown-300" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Search by title, topic, or subject..." />
      </div>

      {filtered && filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r: any) => (
            <div key={r.id} className="card">
              <div className="flex items-start gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-sage-100 text-sage-500 flex items-center justify-center shrink-0">
                  <Library className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-brown-800">{r.title}</p>
                  {r.subject && <p className="text-sm text-brown-400">{r.subject.name}</p>}
                </div>
              </div>
              {r.topic && <span className="badge badge-brown mb-2">{r.topic}</span>}
              {r.description && <p className="text-sm text-brown-500 mt-2">{r.description}</p>}
              {r.file_url && <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-brown-600 hover:underline mt-2 inline-block">View resource →</a>}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Library} title="No resources yet" description="Add past questions and reference materials."
          action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Add Resource</button>} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Resource">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Subject</label>
            <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} className="input">
              <option value="">No subject</option>
              {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Topic</label>
            <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className="input" placeholder="e.g. Algebra" />
          </div>
          <div>
            <label className="label">Resource Type</label>
            <select value={form.resource_type} onChange={(e) => setForm({ ...form, resource_type: e.target.value })} className="input">
              <option value="past_question">Past Question</option>
              <option value="reference">Reference Material</option>
              <option value="textbook">Textbook</option>
              <option value="video">Video</option>
            </select>
          </div>
          <div>
            <label className="label">File URL</label>
            <input value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} className="input" placeholder="https://..." />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" />
          </div>
          <button type="submit" className="btn btn-primary w-full">Add Resource</button>
        </form>
      </Modal>
    </div>
  )
}
