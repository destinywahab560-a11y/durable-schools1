import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, EmptyState } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { ClipboardCheck, Check, X, Clock } from 'lucide-react'

export default function TeacherAttendance() {
  const { profile } = useAuthStore()
  const teacherId = profile?.id
  const queryClient = useQueryClient()
  const [selectedClass, setSelectedClass] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  const { data: classrooms } = useQuery({
    queryKey: ['my-classrooms', teacherId],
    queryFn: async () => {
      const { data } = await supabase
        .from('classrooms')
        .select('id, class_id, class:classes(name, arm, stream), subject:subjects(name)')
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
        .select('student_id, student:profiles(id, first_name, last_name)')
        .eq('class_id', selectedClass)
      return data ?? []
    },
    enabled: !!selectedClass
  })

  const { data: attendance } = useQuery({
    queryKey: ['attendance', selectedClass, date],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('id, student_id, status')
        .eq('class_id', selectedClass)
        .eq('date', date)
      return data ?? []
    },
    enabled: !!selectedClass && !!date
  })

  const markAttendance = async (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    const existing = attendance?.find((a) => a.student_id === studentId)

    if (existing) {
      const { error } = await supabase.from('attendance').update({ status }).eq('id', existing.id)
      if (error) { toast.error(error.message); return }
    } else {
      const classroom = classrooms?.find((c: any) => c.class_id === selectedClass)
      const { data: session } = await supabase
        .from('academic_sessions').select('id').eq('school_id', profile?.school_id).eq('is_current', true).maybeSingle()
      const { error } = await supabase.from('attendance').insert({
        student_id: studentId,
        class_id: selectedClass,
        subject_id: classroom?.subject_id ?? null,
        session_id: session?.id ?? null,
        date,
        status
      })
      if (error) { toast.error(error.message); return }
    }

    queryClient.invalidateQueries({ queryKey: ['attendance', selectedClass, date] })
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Mark daily class attendance" />

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="label">Class</label>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input">
            <option value="">Select class...</option>
            {classrooms?.map((c: any) => (
              <option key={c.id} value={c.class_id}>{c.class?.name} {c.class?.arm} — {c.subject?.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </div>
      </div>

      {selectedClass && students && students.length > 0 ? (
        <div className="space-y-3">
          {students.map((s: any) => {
            const record = attendance?.find((a) => a.student_id === s.student_id)
            return (
              <div key={s.student_id} className="card flex items-center justify-between">
                <p className="font-medium text-brown-700">{s.student?.first_name} {s.student?.last_name}</p>
                <div className="flex gap-2">
                  {(['present', 'absent', 'late', 'excused'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => markAttendance(s.student_id, st)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                        record?.status === st
                          ? st === 'present' ? 'bg-sage-500 text-white' :
                            st === 'absent' ? 'bg-error-500 text-white' :
                            st === 'late' ? 'bg-warning-500 text-white' :
                            'bg-brown-200 text-brown-700'
                          : 'bg-cream-200 text-brown-400 hover:bg-cream-300'
                      )}
                    >
                      {st.charAt(0).toUpperCase() + st.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : selectedClass ? (
        <EmptyState icon={ClipboardCheck} title="No students" description="No students enrolled in this class." />
      ) : (
        <EmptyState icon={ClipboardCheck} title="Select a class" description="Choose a class to mark attendance." />
      )}
    </div>
  )
}
