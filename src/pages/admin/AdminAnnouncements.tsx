import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Modal, Spinner, EmptyState, ConfirmDialog } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { sendNotification } from '@/lib/notify'
import toast from 'react-hot-toast'
import { Megaphone, Plus, School, Trash2 } from 'lucide-react'

export default function AdminAnnouncements() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', target_class_id: '', is_school_wide: true })

  const { data: classes } = useQuery({
    queryKey: ['classes', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('*').eq('school_id', schoolId).order('name')
      return data ?? []
    },
    enabled: !!schoolId
  })

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['announcements', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('announcements')
        .select('id, title, body, is_school_wide, created_at, target_class_id')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!schoolId
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('announcements').insert({
      school_id: schoolId,
      author_id: profile?.id,
      title: form.title,
      body: form.body,
      target_class_id: form.is_school_wide ? null : (form.target_class_id || null),
      is_school_wide: form.is_school_wide
    })
    if (error) { toast.error(error.message); return }

    try {
      let recipientIds: string[] = []
      if (form.is_school_wide) {
        const { data } = await supabase.from('profiles').select('id').eq('school_id', schoolId).neq('id', profile?.id)
        recipientIds = (data ?? []).map((p) => p.id)
      } else if (form.target_class_id) {
        const { data: enrolled } = await supabase.from('student_enrollments').select('student_id, parent_id').eq('class_id', form.target_class_id)
        const { data: classroomTeachers } = await supabase.from('classrooms').select('teacher_id').eq('class_id', form.target_class_id)
        const ids = new Set<string>()
        ;(enrolled ?? []).forEach((e) => { if (e.student_id) ids.add(e.student_id); if (e.parent_id) ids.add(e.parent_id) })
        ;(classroomTeachers ?? []).forEach((c) => { if (c.teacher_id) ids.add(c.teacher_id) })
        recipientIds = [...ids]
      }
      const { count } = await sendNotification({ userIds: recipientIds }, { title: `New Announcement: ${form.title}`, body: form.body, relatedType: 'announcement' })
      toast.success(count > 0 ? `Announcement posted and ${count} people notified` : 'Announcement posted')
    } catch {
      toast.success('Announcement posted (notification delivery had an issue — check the recipients manually)')
    }

    setModalOpen(false)
    setForm({ title: '', body: '', target_class_id: '', is_school_wide: true })
    queryClient.invalidateQueries({ queryKey: ['announcements', schoolId] })
  }

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const handleDelete = async () => {
    if (!deleteId) return
    const { error } = await supabase.from('announcements').delete().eq('id', deleteId)
    if (error) { toast.error(error.message); return }
    toast.success('Announcement deleted')
    setDeleteId(null)
    queryClient.invalidateQueries({ queryKey: ['announcements', schoolId] })
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="Announcements" subtitle="Broadcast to your school"
        action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> New Announcement</button>} />

      {announcements && announcements.length > 0 ? (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="card">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-brown-100 text-brown-600 flex items-center justify-center">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-brown-800">{a.title}</p>
                    <p className="text-xs text-brown-400">{formatDate(a.created_at)}</p>
                  </div>
                </div>
                <span className={`badge ${a.is_school_wide ? 'badge-amber' : 'badge-brown'}`}>
                  {a.is_school_wide ? <><School className="w-3 h-3 mr-1" /> School-wide</> : 'Class'}
                </span>
                <button onClick={() => setDeleteId(a.id)} className="p-2 rounded-lg hover:bg-error-50 text-error-500 ml-2" aria-label="Delete announcement">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-brown-600 text-sm mt-2">{a.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Megaphone} title="No announcements yet" description="Post your first announcement."
          action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> New Announcement</button>} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Announcement">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea required rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="input" />
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_school_wide} onChange={(e) => setForm({ ...form, is_school_wide: e.target.checked })} className="rounded" />
              <span className="text-sm text-brown-600">School-wide announcement</span>
            </label>
          </div>
          {!form.is_school_wide && (
            <div>
              <label className="label">Target Class</label>
              <select value={form.target_class_id} onChange={(e) => setForm({ ...form, target_class_id: e.target.value })} className="input">
                <option value="">Select class...</option>
                {classes?.map((c) => <option key={c.id} value={c.id}>{c.name} {c.arm}</option>)}
              </select>
            </div>
          )}
          <button type="submit" className="btn btn-primary w-full">Post Announcement</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Announcement"
        message="This will remove the announcement for everyone. This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
