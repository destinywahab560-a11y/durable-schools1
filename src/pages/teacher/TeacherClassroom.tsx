import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, Modal, Spinner, EmptyState } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { BookOpen, Plus, FileText, Link as LinkIcon, Video, Calendar, Trash2 } from 'lucide-react'

export default function TeacherClassroom() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'materials' | 'live' | 'assessments'>('materials')
  const [materialModal, setMaterialModal] = useState(false)
  const [liveModal, setLiveModal] = useState(false)
  const [matForm, setMatForm] = useState({ title: '', description: '', file_url: '', external_url: '', topic: '', week: '', file_type: 'pdf' })
  const [liveForm, setLiveForm] = useState({ title: '', scheduled_at: '', duration_minutes: '60', meeting_url: '' })

  const { data: classroom, isLoading } = useQuery({
    queryKey: ['classroom', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('classrooms')
        .select('id, name, description, class:classes(name, arm, stream), subject:subjects(name)')
        .eq('id', id)
        .maybeSingle()
      return data
    },
    enabled: !!id
  })

  const { data: materials } = useQuery({
    queryKey: ['materials', id],
    queryFn: async () => {
      const { data } = await supabase.from('materials').select('*').eq('classroom_id', id).order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!id
  })

  const { data: liveClasses } = useQuery({
    queryKey: ['live-classes', id],
    queryFn: async () => {
      const { data } = await supabase.from('live_classes').select('*').eq('classroom_id', id).order('scheduled_at', { ascending: false })
      return data ?? []
    },
    enabled: !!id
  })

  const { data: assessments } = useQuery({
    queryKey: ['classroom-assessments', id],
    queryFn: async () => {
      const { data } = await supabase.from('assessments').select('*').eq('classroom_id', id).order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!id
  })

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('materials').insert({
      classroom_id: id,
      title: matForm.title,
      description: matForm.description || null,
      file_url: matForm.file_url || null,
      file_type: matForm.file_type,
      external_url: matForm.external_url || null,
      topic: matForm.topic || null,
      week: matForm.week ? parseInt(matForm.week) : null
    })
    if (error) { toast.error(error.message); return }
    toast.success('Material added')
    setMaterialModal(false)
    setMatForm({ title: '', description: '', file_url: '', external_url: '', topic: '', week: '', file_type: 'pdf' })
    queryClient.invalidateQueries({ queryKey: ['materials', id] })
  }

  const handleScheduleLive = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('live_classes').insert({
      classroom_id: id,
      title: liveForm.title,
      scheduled_at: liveForm.scheduled_at,
      duration_minutes: parseInt(liveForm.duration_minutes),
      meeting_url: liveForm.meeting_url || null
    })
    if (error) { toast.error(error.message); return }
    toast.success('Live class scheduled')
    setLiveModal(false)
    setLiveForm({ title: '', scheduled_at: '', duration_minutes: '60', meeting_url: '' })
    queryClient.invalidateQueries({ queryKey: ['live-classes', id] })
  }

  const handleDeleteMaterial = async (matId: string) => {
    const { error } = await supabase.from('materials').delete().eq('id', matId)
    if (error) { toast.error(error.message); return }
    toast.success('Material deleted')
    queryClient.invalidateQueries({ queryKey: ['materials', id] })
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title={classroom?.name ?? 'Classroom'} subtitle={`${classroom?.class?.name} ${classroom?.class?.arm} • ${classroom?.subject?.name}`} />

      <div className="flex gap-2 mb-6 border-b border-cream-300">
        {[
          { key: 'materials', label: 'Materials', icon: FileText },
          { key: 'live', label: 'Live Classes', icon: Video },
          { key: 'assessments', label: 'Assessments', icon: Calendar }
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-brown-600 text-brown-700' : 'border-transparent text-brown-400 hover:text-brown-600'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'materials' && (
        <div>
          <div className="flex justify-end mb-4">
            <button className="btn btn-primary" onClick={() => setMaterialModal(true)}><Plus className="w-4 h-4" /> Add Material</button>
          </div>
          {materials && materials.length > 0 ? (
            <div className="space-y-3">
              {materials.map((m) => (
                <div key={m.id} className="card flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-brown-100 text-brown-600 flex items-center justify-center">
                      {m.external_url ? <LinkIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-semibold text-brown-800">{m.title}</p>
                      <p className="text-sm text-brown-400">
                        {m.topic && `${m.topic} • `}Week {m.week || '—'} • {formatDate(m.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.external_url && <a href={m.external_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-sm">Open</a>}
                    {m.file_url && <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-sm">View</a>}
                    <button onClick={() => handleDeleteMaterial(m.id)} className="p-2 rounded-lg hover:bg-error-50 text-error-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={FileText} title="No materials yet" description="Upload notes, slides, or share links with your students."
              action={<button className="btn btn-primary" onClick={() => setMaterialModal(true)}><Plus className="w-4 h-4" /> Add Material</button>} />
          )}
        </div>
      )}

      {tab === 'live' && (
        <div>
          <div className="flex justify-end mb-4">
            <button className="btn btn-primary" onClick={() => setLiveModal(true)}><Plus className="w-4 h-4" /> Schedule Live Class</button>
          </div>
          {liveClasses && liveClasses.length > 0 ? (
            <div className="space-y-3">
              {liveClasses.map((lc) => (
                <div key={lc.id} className="card flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-brown-800">{lc.title}</p>
                      <p className="text-sm text-brown-400">{formatDate(lc.scheduled_at)} • {lc.duration_minutes} min</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${lc.status === 'live' ? 'badge-error' : lc.status === 'ended' ? 'badge-brown' : 'badge-amber'}`}>{lc.status}</span>
                    {lc.meeting_url && <a href={lc.meeting_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-sm">Start</a>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Video} title="No live classes scheduled" description="Schedule a live video lesson for your students."
              action={<button className="btn btn-primary" onClick={() => setLiveModal(true)}><Plus className="w-4 h-4" /> Schedule Live Class</button>} />
          )}
        </div>
      )}

      {tab === 'assessments' && (
        <div>
          {assessments && assessments.length > 0 ? (
            <div className="space-y-3">
              {assessments.map((a) => (
                <div key={a.id} className="card flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-brown-800">{a.title}</p>
                    <p className="text-sm text-brown-400">{a.type} • {a.total_marks} marks</p>
                  </div>
                  <span className={`badge ${a.is_published ? 'badge-sage' : 'badge-brown'}`}>
                    {a.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Calendar} title="No assessments yet" description="Create quizzes, tests, and exams from the Assessments page." />
          )}
        </div>
      )}

      <Modal open={materialModal} onClose={() => setMaterialModal(false)} title="Add Material">
        <form onSubmit={handleAddMaterial} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input required value={matForm.title} onChange={(e) => setMatForm({ ...matForm, title: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea rows={2} value={matForm.description} onChange={(e) => setMatForm({ ...matForm, description: e.target.value })} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Topic</label>
              <input value={matForm.topic} onChange={(e) => setMatForm({ ...matForm, topic: e.target.value })} className="input" placeholder="e.g. Fractions" />
            </div>
            <div>
              <label className="label">Week</label>
              <input type="number" value={matForm.week} onChange={(e) => setMatForm({ ...matForm, week: e.target.value })} className="input" placeholder="1" />
            </div>
          </div>
          <div>
            <label className="label">File URL (PDF, slides, video, etc.)</label>
            <input value={matForm.file_url} onChange={(e) => setMatForm({ ...matForm, file_url: e.target.value })} className="input" placeholder="https://..." />
          </div>
          <div>
            <label className="label">Or External Link (YouTube, article)</label>
            <input value={matForm.external_url} onChange={(e) => setMatForm({ ...matForm, external_url: e.target.value })} className="input" placeholder="https://..." />
          </div>
          <div>
            <label className="label">File Type</label>
            <select value={matForm.file_type} onChange={(e) => setMatForm({ ...matForm, file_type: e.target.value })} className="input">
              <option value="pdf">PDF</option>
              <option value="slides">Slides</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
              <option value="image">Image</option>
              <option value="link">Link</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary w-full">Add Material</button>
        </form>
      </Modal>

      <Modal open={liveModal} onClose={() => setLiveModal(false)} title="Schedule Live Class">
        <form onSubmit={handleScheduleLive} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input required value={liveForm.title} onChange={(e) => setLiveForm({ ...liveForm, title: e.target.value })} className="input" placeholder="e.g. Introduction to Algebra" />
          </div>
          <div>
            <label className="label">Date & Time</label>
            <input type="datetime-local" required value={liveForm.scheduled_at} onChange={(e) => setLiveForm({ ...liveForm, scheduled_at: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Duration (minutes)</label>
            <input type="number" required value={liveForm.duration_minutes} onChange={(e) => setLiveForm({ ...liveForm, duration_minutes: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Meeting URL (Zoom, Google Meet, etc.)</label>
            <input value={liveForm.meeting_url} onChange={(e) => setLiveForm({ ...liveForm, meeting_url: e.target.value })} className="input" placeholder="https://meet.google.com/..." />
          </div>
          <button type="submit" className="btn btn-primary w-full">Schedule Class</button>
        </form>
      </Modal>
    </div>
  )
}
