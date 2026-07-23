import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Modal, Spinner, EmptyState } from '@/components/ui'
import toast from 'react-hot-toast'
import { ClipboardList, Plus, Trash2, CheckCircle, Eye } from 'lucide-react'

export default function TeacherAssessments() {
  const { profile } = useAuthStore()
  const teacherId = profile?.id
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [questionModal, setQuestionModal] = useState(false)
  const [selectedAssessment, setSelectedAssessment] = useState<string | null>(null)
  const [form, setForm] = useState({
    classroom_id: '', title: '', type: 'quiz', total_marks: '100', duration_minutes: '30',
    max_attempts: '1', open_at: '', close_at: '', is_combined: false
  })
  const [qForm, setQForm] = useState({
    question_text: '', question_type: 'multiple_choice', options: ['', '', '', ''],
    correct_answer: '', marks: '1'
  })

  const { data: classrooms } = useQuery({
    queryKey: ['my-classrooms', teacherId],
    queryFn: async () => {
      const { data } = await supabase
        .from('classrooms')
        .select('id, name, subject_id, class:classes(name, arm), subject:subjects(name)')
        .eq('teacher_id', teacherId)
        .order('name')
      return data ?? []
    },
    enabled: !!teacherId
  })

  const { data: assessments, isLoading } = useQuery({
    queryKey: ['my-assessments', teacherId],
    queryFn: async () => {
      const { data } = await supabase
        .from('assessments')
        .select(`
          id, title, type, total_marks, is_published, open_at, close_at, classroom_id,
          classroom:classrooms(name, class:classes(name, arm), subject:subjects(name))
        `)
        .in('classroom_id', classrooms?.map((c) => c.id) ?? [])
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!classrooms && classrooms.length > 0
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('assessments').insert({
      classroom_id: form.classroom_id,
      title: form.title,
      type: form.type,
      total_marks: parseFloat(form.total_marks),
      duration_minutes: parseInt(form.duration_minutes) || null,
      max_attempts: parseInt(form.max_attempts),
      open_at: form.open_at || null,
      close_at: form.close_at || null,
      is_combined: form.is_combined
    })
    if (error) { toast.error(error.message); return }
    toast.success('Assessment created')
    setModalOpen(false)
    setForm({ classroom_id: '', title: '', type: 'quiz', total_marks: '100', duration_minutes: '30', max_attempts: '1', open_at: '', close_at: '', is_combined: false })
    queryClient.invalidateQueries({ queryKey: ['my-assessments', teacherId] })
  }

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAssessment) return

    const targetClassroomId = assessments?.find((a: any) => a.id === selectedAssessment)?.classroom_id
    const classroom = classrooms?.find((c: any) => c.id === targetClassroomId)
    const subjectId = (classroom as any)?.subject_id
    if (!subjectId || !profile?.school_id) return

    const { data: question, error: qErr } = await supabase.from('questions').insert({
      subject_id: subjectId,
      school_id: profile.school_id,
      question_text: qForm.question_text,
      question_type: qForm.question_type,
      options: qForm.question_type === 'multiple_choice' ? qForm.options.filter(o => o) : null,
      correct_answer: qForm.correct_answer,
      marks: parseFloat(qForm.marks)
    }).select().single()

    if (qErr) { toast.error(qErr.message); return }

    const { error: aqErr } = await supabase.from('assessment_questions').insert({
      assessment_id: selectedAssessment,
      question_id: question.id
    })
    if (aqErr) { toast.error(aqErr.message); return }

    toast.success('Question added')
    setQuestionModal(false)
    setQForm({ question_text: '', question_type: 'multiple_choice', options: ['', '', '', ''], correct_answer: '', marks: '1' })
  }

  const togglePublish = async (id: string, current: boolean) => {
    const { error } = await supabase.from('assessments').update({ is_published: !current }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success(!current ? 'Assessment published' : 'Assessment unpublished')
    queryClient.invalidateQueries({ queryKey: ['my-assessments', teacherId] })
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="Assessments" subtitle="Create and manage quizzes, tests, and exams"
        action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Create Assessment</button>} />

      {assessments && assessments.length > 0 ? (
        <div className="space-y-3">
          {assessments.map((a: any) => (
            <div key={a.id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-brown-800">{a.title}</p>
                  <p className="text-sm text-brown-400">
                    {a.classroom?.subject?.name} • {a.classroom?.class?.name} {a.classroom?.class?.arm} •
                    {a.type} • {a.total_marks} marks
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${a.is_published ? 'badge-sage' : 'badge-brown'}`}>
                    {a.is_published ? 'Published' : 'Draft'}
                  </span>
                  <button className="btn btn-ghost text-sm" onClick={() => { setSelectedAssessment(a.id); setQuestionModal(true) }}>
                    <Eye className="w-4 h-4" /> Add Questions
                  </button>
                  <button className="btn btn-outline text-sm" onClick={() => togglePublish(a.id, a.is_published)}>
                    {a.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={ClipboardList} title="No assessments yet" description="Create your first quiz, test, or exam."
          action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Create Assessment</button>} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Assessment" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Classroom</label>
            <select required value={form.classroom_id} onChange={(e) => setForm({ ...form, classroom_id: e.target.value })} className="input">
              <option value="">Select classroom...</option>
              {classrooms?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Title</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" placeholder="e.g. First Term Math Test" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input">
                <option value="quiz">Quiz</option>
                <option value="test">Test</option>
                <option value="exam">Exam</option>
              </select>
            </div>
            <div>
              <label className="label">Total Marks</label>
              <input type="number" required value={form.total_marks} onChange={(e) => setForm({ ...form, total_marks: e.target.value })} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Duration (minutes)</label>
              <input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Max Attempts</label>
              <input type="number" value={form.max_attempts} onChange={(e) => setForm({ ...form, max_attempts: e.target.value })} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Opens At</label>
              <input type="datetime-local" value={form.open_at} onChange={(e) => setForm({ ...form, open_at: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Closes At</label>
              <input type="datetime-local" value={form.close_at} onChange={(e) => setForm({ ...form, close_at: e.target.value })} className="input" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_combined} onChange={(e) => setForm({ ...form, is_combined: e.target.checked })} className="rounded" />
            <span className="text-sm text-brown-600">Combined assessment (cross-class)</span>
          </label>
          <button type="submit" className="btn btn-primary w-full">Create Assessment</button>
        </form>
      </Modal>

      <Modal open={questionModal} onClose={() => setQuestionModal(false)} title="Add Question" size="lg">
        <form onSubmit={handleAddQuestion} className="space-y-4">
          <div>
            <label className="label">Question Text</label>
            <textarea required rows={3} value={qForm.question_text} onChange={(e) => setQForm({ ...qForm, question_text: e.target.value })} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Question Type</label>
              <select value={qForm.question_type} onChange={(e) => setQForm({ ...qForm, question_type: e.target.value })} className="input">
                <option value="multiple_choice">Multiple Choice</option>
                <option value="true_false">True / False</option>
                <option value="fill_blank">Fill in the Blank</option>
                <option value="short_answer">Short Answer</option>
                <option value="essay">Essay</option>
              </select>
            </div>
            <div>
              <label className="label">Marks</label>
              <input type="number" required value={qForm.marks} onChange={(e) => setQForm({ ...qForm, marks: e.target.value })} className="input" />
            </div>
          </div>
          {qForm.question_type === 'multiple_choice' && (
            <div>
              <label className="label">Options</label>
              {qForm.options.map((opt, i) => (
                <input
                  key={i}
                  value={opt}
                  onChange={(e) => {
                    const newOpts = [...qForm.options]; newOpts[i] = e.target.value
                    setQForm({ ...qForm, options: newOpts })
                  }}
                  className="input mb-2"
                  placeholder={`Option ${i + 1}`}
                />
              ))}
            </div>
          )}
          {qForm.question_type !== 'essay' && (
            <div>
              <label className="label">Correct Answer</label>
              <input value={qForm.correct_answer} onChange={(e) => setQForm({ ...qForm, correct_answer: e.target.value })} className="input" placeholder="The correct answer" />
            </div>
          )}
          <button type="submit" className="btn btn-primary w-full">Add Question</button>
        </form>
      </Modal>
    </div>
  )
}
