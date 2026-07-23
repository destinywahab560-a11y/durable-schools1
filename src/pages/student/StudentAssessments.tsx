import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Modal, Spinner, EmptyState } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { ClipboardList, Clock, CheckCircle, AlertCircle, PlayCircle } from 'lucide-react'

export default function StudentAssessments() {
  const { profile } = useAuthStore()
  const studentId = profile?.id
  const queryClient = useQueryClient()
  const [takeModal, setTakeModal] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const { data: enrollment } = useQuery({
    queryKey: ['my-enrollment', studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_enrollments')
        .select('class:classes(id)')
        .eq('student_id', studentId)
        .maybeSingle()
      return data
    },
    enabled: !!studentId
  })

  const { data: classrooms } = useQuery({
    queryKey: ['student-classrooms-list', studentId],
    queryFn: async () => {
      if (!enrollment?.class?.id) return []
      const { data } = await supabase.from('classrooms').select('id').eq('class_id', enrollment.class.id)
      return data ?? []
    },
    enabled: !!enrollment?.class?.id
  })

  const { data: assessments, isLoading } = useQuery({
    queryKey: ['student-assessments-list', studentId],
    queryFn: async () => {
      if (!classrooms || classrooms.length === 0) return []
      const { data } = await supabase
        .from('assessments')
        .select(`
          id, title, type, total_marks, duration_minutes, open_at, close_at, is_published,
          classroom:classrooms(name, subject:subjects(name))
        `)
        .eq('is_published', true)
        .in('classroom_id', classrooms.map((c) => c.id))
        .order('open_at', { ascending: true })
      return data ?? []
    },
    enabled: !!classrooms && classrooms.length > 0
  })

  const { data: questions } = useQuery({
    queryKey: ['assessment-questions', takeModal],
    queryFn: async () => {
      if (!takeModal) return []
      const { data } = await supabase
        .from('assessment_questions')
        .select('id, question:questions(id, question_text, question_type, options, marks)')
        .eq('assessment_id', takeModal)
      return data ?? []
    },
    enabled: !!takeModal
  })

  const { data: submissions } = useQuery({
    queryKey: ['my-submissions', studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('assessment_submissions')
        .select('id, assessment_id, status, score')
        .eq('student_id', studentId)
      return data ?? []
    },
    enabled: !!studentId
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!takeModal) return

    const assessment = assessments?.find((a) => a.id === takeModal)
    const { data: submission, error: subErr } = await supabase.from('assessment_submissions').insert({
      assessment_id: takeModal,
      student_id: studentId,
      status: 'submitted',
      submitted_at: new Date().toISOString()
    }).select().single()

    if (subErr) { toast.error(subErr.message); return }

    let totalScore = 0
    let totalMarks = 0

    for (const aq of questions ?? []) {
      const q = aq.question as any
      if (!q) continue
      const userAnswer = answers[q.id] || ''
      const isCorrect = q.question_type !== 'essay' && q.question_type !== 'short_answer'
        ? userAnswer.toLowerCase() === q.correct_answer?.toLowerCase()
        : null
      const marks = isCorrect ? q.marks : 0
      totalMarks += q.marks
      if (isCorrect) totalScore += q.marks

      await supabase.from('answers').insert({
        submission_id: submission.id,
        question_id: q.id,
        answer_text: userAnswer,
        is_correct: isCorrect,
        marks_awarded: marks
      })
    }

    const finalScore = totalMarks > 0 ? (totalScore / totalMarks) * (assessment?.total_marks ?? 100) : 0
    await supabase.from('assessment_submissions').update({
      status: 'graded',
      score: finalScore,
      graded_at: new Date().toISOString()
    }).eq('id', submission.id)

    toast.success(`Assessment submitted! Score: ${finalScore.toFixed(1)}/${assessment?.total_marks ?? 100}`)
    setTakeModal(null)
    setAnswers({})
    queryClient.invalidateQueries({ queryKey: ['my-submissions', studentId] })
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="Assessments" subtitle="Your quizzes, tests, and exams" />

      {assessments && assessments.length > 0 ? (
        <div className="space-y-3">
          {assessments.map((a: any) => {
            const submission = submissions?.find((s) => s.assessment_id === a.id)
            return (
              <div key={a.id} className="card flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-brown-100 text-brown-600 flex items-center justify-center">
                    {submission ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-semibold text-brown-800">{a.title}</p>
                    <p className="text-sm text-brown-400">
                      {a.classroom?.subject?.name} • {a.type} • {a.total_marks} marks
                      {a.duration_minutes && ` • ${a.duration_minutes} min`}
                    </p>
                    {a.open_at && <p className="text-xs text-brown-300 mt-1">Opens: {formatDate(a.open_at)}</p>}
                  </div>
                </div>
                {submission ? (
                  <div className="text-right">
                    <p className="text-lg font-bold text-brown-800">{submission.score?.toFixed(1)}</p>
                    <p className="text-xs text-sage-500">Submitted</p>
                  </div>
                ) : (
                  <button className="btn btn-primary text-sm" onClick={() => { setTakeModal(a.id); setAnswers({}) }}>
                    <PlayCircle className="w-4 h-4" /> Take
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState icon={ClipboardList} title="No assessments" description="Your assessments will appear here once published." />
      )}

      <Modal open={!!takeModal} onClose={() => setTakeModal(null)} title="Take Assessment" size="xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {questions && questions.length > 0 ? (
            questions.map((aq: any, i: number) => {
              const q = aq.question as any
              if (!q) return null
              return (
                <div key={aq.id} className="card bg-cream-100">
                  <p className="font-semibold text-brown-800 mb-3">
                    {i + 1}. {q.question_text} <span className="text-sm text-brown-400">({q.marks} marks)</span>
                  </p>
                  {q.question_type === 'multiple_choice' && q.options && (
                    <div className="space-y-2">
                      {q.options.map((opt: string, j: number) => (
                        <label key={j} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-cream-200">
                          <input
                            type="radio"
                            name={q.id}
                            value={opt}
                            checked={answers[q.id] === opt}
                            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                            className="text-brown-600"
                          />
                          <span className="text-sm text-brown-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {q.question_type === 'true_false' && (
                    <div className="flex gap-3">
                      {['True', 'False'].map((opt) => (
                        <label key={opt} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-cream-200">
                          <input
                            type="radio"
                            name={q.id}
                            value={opt}
                            checked={answers[q.id] === opt}
                            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                            className="text-brown-600"
                          />
                          <span className="text-sm text-brown-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {(q.question_type === 'fill_blank' || q.question_type === 'short_answer') && (
                    <input
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      className="input"
                      placeholder="Your answer..."
                    />
                  )}
                  {q.question_type === 'essay' && (
                    <textarea
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      rows={5}
                      className="input"
                      placeholder="Write your essay..."
                    />
                  )}
                </div>
              )
            })
          ) : (
            <Spinner />
          )}
          <button type="submit" className="btn btn-primary w-full">Submit Assessment</button>
        </form>
      </Modal>
    </div>
  )
}
