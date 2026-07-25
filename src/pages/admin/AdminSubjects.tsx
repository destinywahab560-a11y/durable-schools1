import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Modal, Spinner, EmptyState, ConfirmDialog } from '@/components/ui'
import { SS_STREAMS } from '@/lib/utils'
import toast from 'react-hot-toast'
import { BookOpen, Plus, Trash2, Pencil } from 'lucide-react'

export default function AdminSubjects() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  const [selectedStreams, setSelectedStreams] = useState<string[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: classes } = useQuery({
    queryKey: ['classes', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('*').eq('school_id', schoolId).order('name')
      return data ?? []
    },
    enabled: !!schoolId
  })

  const nonSsClasses = classes?.filter((c) => c.level !== 'ss') ?? []

  const { data: subjects, isLoading } = useQuery({
    queryKey: ['subjects-with-classes', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*, class_subjects(class_id, class:classes(name, arm, stream))')
        .eq('school_id', schoolId)
        .order('name')
      if (error) { console.error('Fetch subjects error:', error); throw error }
      return data ?? []
    },
    enabled: !!schoolId
  })

  const resetForm = () => {
    setModalOpen(false)
    setEditingId(null)
    setName('')
    setCode('')
    setSelectedClassIds([])
    setSelectedStreams([])
  }

  const openEdit = (subject: any) => {
    setEditingId(subject.id)
    setName(subject.name)
    setCode(subject.code ?? '')
    const linkedClasses = subject.class_subjects ?? []
    const linkedClassIds: string[] = linkedClasses.map((cs: any) => cs.class_id)
    // A subject is "stream-linked" if it's attached to every class of that
    // stream — reconstruct which stream checkboxes should show as checked.
    const streams = SS_STREAMS.filter((stream) => {
      const ssClassesInStream = classes?.filter((c) => c.level === 'ss' && c.stream === stream) ?? []
      return ssClassesInStream.length > 0 && ssClassesInStream.every((c) => linkedClassIds.includes(c.id))
    })
    setSelectedStreams(streams)
    // Remaining direct (non-stream) class links go in the specific-classes list
    const streamClassIds = new Set(
      streams.flatMap((stream) => (classes?.filter((c) => c.level === 'ss' && c.stream === stream) ?? []).map((c) => c.id))
    )
    setSelectedClassIds(linkedClassIds.filter((id) => !streamClassIds.has(id)))
    setModalOpen(true)
  }

  const toggleClass = (id: string) => {
    setSelectedClassIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }
  const toggleStream = (stream: string) => {
    setSelectedStreams((prev) => (prev.includes(stream) ? prev.filter((s) => s !== stream) : [...prev, stream]))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    let subjectId = editingId
    if (!subjectId) {
      const { data, error } = await supabase.from('subjects').insert({ school_id: schoolId, name, code: code || null }).select('id').single()
      if (error) { toast.error(error.message); return }
      subjectId = data.id
    } else {
      const { error } = await supabase.from('subjects').update({ name, code: code || null }).eq('id', subjectId)
      if (error) { toast.error(error.message); return }
      // Clear existing links so we can cleanly re-write them below
      await supabase.from('class_subjects').delete().eq('subject_id', subjectId)
    }

    // Resolve streams into their actual matching SS classes (all levels, all arms)
    const streamClassIds = selectedStreams.flatMap((stream) =>
      (classes?.filter((c) => c.level === 'ss' && c.stream === stream) ?? []).map((c) => c.id)
    )
    const allClassIds = [...new Set([...selectedClassIds, ...streamClassIds])]

    if (allClassIds.length > 0) {
      const rows = allClassIds.map((classId) => ({ class_id: classId, subject_id: subjectId, is_core: true }))
      const { error: linkError } = await supabase.from('class_subjects').insert(rows)
      if (linkError) { toast.error(linkError.message); return }
    }

    toast.success(editingId ? 'Subject updated' : 'Subject created')
    resetForm()
    queryClient.invalidateQueries({ queryKey: ['subjects-with-classes', schoolId] })
    queryClient.invalidateQueries({ queryKey: ['subjects', schoolId] })
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const { error } = await supabase.from('subjects').delete().eq('id', deleteId)
    if (error) { toast.error(error.message); setDeleteId(null); return }
    toast.success('Subject deleted')
    setDeleteId(null)
    queryClient.invalidateQueries({ queryKey: ['subjects-with-classes', schoolId] })
    queryClient.invalidateQueries({ queryKey: ['subjects', schoolId] })
  }

  const describeLinkage = (subject: any) => {
    const linked = subject.class_subjects ?? []
    if (linked.length === 0) return 'Not linked to any class yet'
    const streams = SS_STREAMS.filter((stream) => {
      const ssClassesInStream = classes?.filter((c) => c.level === 'ss' && c.stream === stream) ?? []
      const linkedIds = linked.map((l: any) => l.class_id)
      return ssClassesInStream.length > 0 && ssClassesInStream.every((c) => linkedIds.includes(c.id))
    })
    const streamClassIds = new Set(
      streams.flatMap((stream) => (classes?.filter((c) => c.level === 'ss' && c.stream === stream) ?? []).map((c) => c.id))
    )
    const directNames = linked
      .filter((l: any) => !streamClassIds.has(l.class_id))
      .map((l: any) => `${l.class?.name} ${l.class?.arm}`)
    const parts = [...streams.map((s) => `SS (${s})`), ...directNames]
    return parts.join(', ')
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="Subjects" subtitle="Manage your school's subject list"
        action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Add Subject</button>} />

      {subjects && subjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((s: any) => (
            <div key={s.id} className="card">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-brown-800">{s.name}</p>
                  {s.code && <p className="text-sm text-brown-400">{s.code}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(s)} className="p-2 rounded-lg hover:bg-cream-200 text-brown-500" aria-label="Edit subject">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteId(s.id)} className="p-2 rounded-lg hover:bg-error-50 text-error-500" aria-label="Delete subject">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-brown-400">{describeLinkage(s)}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={BookOpen} title="No subjects yet" description="Add subjects to map them to classes."
          action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Add Subject</button>} />
      )}

      <Modal open={modalOpen} onClose={resetForm} title={editingId ? 'Edit Subject' : 'Add Subject'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Subject Name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g. Mathematics" />
          </div>
          <div>
            <label className="label">Subject Code (optional)</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className="input" placeholder="e.g. MTH101" />
          </div>

          <div>
            <label className="label">Senior Secondary Streams</label>
            <p className="text-xs text-brown-400 mb-2">Check any that apply — this subject will automatically cover every SS1–SS3 class in the streams you pick.</p>
            <div className="flex gap-3">
              {SS_STREAMS.map((stream) => (
                <label key={stream} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selectedStreams.includes(stream)} onChange={() => toggleStream(stream)} />
                  {stream}
                </label>
              ))}
            </div>
          </div>

          {nonSsClasses.length > 0 && (
            <div>
              <label className="label">Specific Classes (Primary / JSS)</label>
              <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                {nonSsClasses.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selectedClassIds.includes(c.id)} onChange={() => toggleClass(c.id)} />
                    {c.name} {c.arm}
                  </label>
                ))}
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary w-full">{editingId ? 'Save Changes' : 'Create Subject'}</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Subject"
        message="This removes the subject and all its class links. Existing classrooms/gradebooks for it are unaffected. This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
