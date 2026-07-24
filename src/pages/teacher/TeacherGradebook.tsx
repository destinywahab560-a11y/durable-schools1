import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Modal, Spinner, EmptyState } from '@/components/ui'
import { gradeFromScore } from '@/lib/utils'
import toast from 'react-hot-toast'
import { BarChart3, Lock, Unlock } from 'lucide-react'

export default function TeacherGradebook() {
  const { profile } = useAuthStore()
  const teacherId = profile?.id
  const queryClient = useQueryClient()
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [gradeModal, setGradeModal] = useState(false)
  const [gradeForm, setGradeForm] = useState({ student_id: '', ca_score: '', exam_score: '', teacher_remark: '' })

  const { data: classrooms } = useQuery({
    queryKey: ['my-classrooms', teacherId],
    queryFn: async () => {
      const { data } = await supabase
        .from('classrooms')
        .select('id, class_id, subject_id, class:classes(name, arm, stream), subject:subjects(name)')
        .eq('teacher_id', teacherId)
      return data ?? []
    },
    enabled: !!teacherId
  })

  const { data: students, isLoading } = useQuery({
    queryKey: ['class-students', selectedClass],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_enrollments')
        .select('student_id, student:profiles!student_id(id, first_name, last_name)')
        .eq('class_id', selectedClass)
      return data ?? []
    },
    enabled: !!selectedClass
  })

  const { data: gradebook } = useQuery({
    queryKey: ['gradebook', selectedClass, selectedSubject],
    queryFn: async () => {
      const { data } = await supabase
        .from('gradebook')
        .select('*')
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
      return data ?? []
    },
    enabled: !!selectedClass && !!selectedSubject
  })

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault()
    const ca = parseFloat(gradeForm.ca_score) || 0
    const exam = parseFloat(gradeForm.exam_score) || 0
    const total = ca + exam
    const { grade } = gradeFromScore(total, 100)

    const existing = gradebook?.find((g) => g.student_id === gradeForm.student_id)

    if (existing) {
      const { error } = await supabase.from('gradebook').update({
        ca_score: ca, exam_score: exam, total_score: total, grade,
        teacher_remark: gradeForm.teacher_remark
      }).eq('id', existing.id)
      if (error) { toast.error(error.message); return }
    } else {
      const { data: session } = await supabase
        .from('academic_sessions').select('id').eq('school_id', profile?.school_id).eq('is_current', true).maybeSingle()
      const { error } = await supabase.from('gradebook').insert({
        student_id: gradeForm.student_id,
        subject_id: selectedSubject,
        class_id: selectedClass,
        session_id: session?.id ?? null,
        ca_score: ca, exam_score: exam, total_score: total, grade,
        teacher_remark: gradeForm.teacher_remark
      })
      if (error) { toast.error(error.message); return }
    }

    toast.success('Grade saved')
    setGradeModal(false)
    setGradeForm({ student_id: '', ca_score: '', exam_score: '', teacher_remark: '' })
    queryClient.invalidateQueries({ queryKey: ['gradebook', selectedClass, selectedSubject] })
  }

  const releaseResults = async () => {
    const { error } = await supabase.from('gradebook')
      .update({ is_released: true })
      .eq('class_id', selectedClass)
      .eq('subject_id', selectedSubject)
    if (error) { toast.error(error.message); return }
    toast.success('Results released to students and parents')
    queryClient.invalidateQueries({ queryKey: ['gradebook', selectedClass, selectedSubject] })

    await supabase.from('audit_logs').insert({
      school_id: profile?.school_id,
      actor_id: teacherId,
      action: 'released results',
      entity_type: 'gradebook',
      details: { class_id: selectedClass, subject_id: selectedSubject }
    })
  }

  return (
    <div>
      <PageHeader title="Gradebook" subtitle="Enter and manage student grades" />

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="label">Class</label>
          <select value={selectedClass} onChange={(e) => {
            const cls = classrooms?.find((c: any) => c.class_id === e.target.value)
            setSelectedClass(e.target.value)
            setSelectedSubject(cls?.subject_id ?? '')
          }} className="input">
            <option value="">Select class...</option>
            {classrooms?.map((c: any) => (
              <option key={c.id} value={c.class_id}>{c.class?.name} {c.class?.arm} — {c.subject?.name}</option>
            ))}
          </select>
        </div>
        {selectedClass && (
          <button className="btn btn-secondary self-end" onClick={releaseResults}>
            <Unlock className="w-4 h-4" /> Release Results
          </button>
        )}
      </div>

      {selectedClass && students && students.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-cream-300">
                <th className="text-left py-3 px-2 text-sm font-semibold text-brown-600">Student</th>
                <th className="text-center py-3 px-2 text-sm font-semibold text-brown-600">CA (40)</th>
                <th className="text-center py-3 px-2 text-sm font-semibold text-brown-600">Exam (60)</th>
                <th className="text-center py-3 px-2 text-sm font-semibold text-brown-600">Total</th>
                <th className="text-center py-3 px-2 text-sm font-semibold text-brown-600">Grade</th>
                <th className="text-center py-3 px-2 text-sm font-semibold text-brown-600">Status</th>
                <th className="text-center py-3 px-2 text-sm font-semibold text-brown-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s: any) => {
                const entry = gradebook?.find((g) => g.student_id === s.student_id)
                return (
                  <tr key={s.student_id} className="border-b border-cream-200 last:border-0">
                    <td className="py-3 px-2 text-sm text-brown-700">{s.student?.first_name} {s.student?.last_name}</td>
                    <td className="py-3 px-2 text-center text-sm text-brown-600">{entry?.ca_score ?? '—'}</td>
                    <td className="py-3 px-2 text-center text-sm text-brown-600">{entry?.exam_score ?? '—'}</td>
                    <td className="py-3 px-2 text-center text-sm font-semibold text-brown-800">{entry?.total_score ?? '—'}</td>
                    <td className="py-3 px-2 text-center">
                      {entry?.grade && <span className="badge badge-amber">{entry.grade}</span>}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {entry?.is_released ? <span className="badge badge-sage">Released</span> : <span className="badge badge-brown">Draft</span>}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <button className="btn btn-ghost text-sm" onClick={() => {
                        setGradeForm({
                          student_id: s.student_id,
                          ca_score: entry?.ca_score?.toString() ?? '',
                          exam_score: entry?.exam_score?.toString() ?? '',
                          teacher_remark: entry?.teacher_remark ?? ''
                        })
                        setGradeModal(true)
                      }}>Edit</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : selectedClass ? (
        <EmptyState icon={BarChart3} title="No students in this class" description="Students need to be enrolled first." />
      ) : (
        <EmptyState icon={BarChart3} title="Select a class" description="Choose a class to view and manage grades." />
      )}

      <Modal open={gradeModal} onClose={() => setGradeModal(false)} title="Enter Grades">
        <form onSubmit={handleSaveGrade} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">CA Score (out of 40)</label>
              <input type="number" min="0" max="40" required value={gradeForm.ca_score} onChange={(e) => setGradeForm({ ...gradeForm, ca_score: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Exam Score (out of 60)</label>
              <input type="number" min="0" max="60" required value={gradeForm.exam_score} onChange={(e) => setGradeForm({ ...gradeForm, exam_score: e.target.value })} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Teacher Remark</label>
            <textarea rows={2} value={gradeForm.teacher_remark} onChange={(e) => setGradeForm({ ...gradeForm, teacher_remark: e.target.value })} className="input" placeholder="e.g. Keep up the good work" />
          </div>
          <button type="submit" className="btn btn-primary w-full">Save Grade</button>
        </form>
      </Modal>
    </div>
  )
}
