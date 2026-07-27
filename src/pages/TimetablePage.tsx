import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, EmptyState } from '@/components/ui'
import { Clock } from 'lucide-react'

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' }
]

export default function TimetablePage() {
  const { profile } = useAuthStore()
  const role = profile?.role
  const [selectedChild, setSelectedChild] = useState('')

  const { data: children } = useQuery({
    queryKey: ['timetable-my-children', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_enrollments')
        .select('student_id, student:profiles!student_id(first_name, last_name)')
        .eq('parent_id', profile?.id)
      return data ?? []
    },
    enabled: role === 'parent' && !!profile?.id
  })

  const activeStudentId = role === 'student' ? profile?.id : (selectedChild || children?.[0]?.student_id)

  const { data: classroomIds } = useQuery({
    queryKey: ['timetable-classroom-ids', role, profile?.id, activeStudentId],
    queryFn: async () => {
      if (role === 'teacher') {
        const { data } = await supabase.from('classrooms').select('id').eq('teacher_id', profile?.id)
        return (data ?? []).map((c) => c.id)
      }
      if ((role === 'student' || role === 'parent') && activeStudentId) {
        const { data: enrollment } = await supabase.from('student_enrollments').select('class_id').eq('student_id', activeStudentId).maybeSingle()
        if (!enrollment?.class_id) return []
        const { data } = await supabase.from('classrooms').select('id').eq('class_id', enrollment.class_id)
        return (data ?? []).map((c) => c.id)
      }
      return []
    },
    enabled: !!role && (role === 'teacher' || !!activeStudentId)
  })

  const { data: slots, isLoading } = useQuery({
    queryKey: ['my-timetable-slots', classroomIds],
    queryFn: async () => {
      if (!classroomIds || classroomIds.length === 0) return []
      const { data, error } = await supabase
        .from('timetable_slots')
        .select('id, day_of_week, start_time, end_time, classroom:classrooms(name, subject:subjects(name), class:classes(name, arm), teacher:profiles!teacher_id(first_name, last_name))')
        .in('classroom_id', classroomIds)
        .order('start_time')
      if (error) { console.error('Fetch timetable error:', error); throw error }
      return data ?? []
    },
    enabled: classroomIds !== undefined
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="Timetable" subtitle="Your weekly class schedule" />

      {role === 'parent' && children && children.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {children.map((c: any) => (
            <button
              key={c.student_id}
              onClick={() => setSelectedChild(c.student_id)}
              className={`px-4 py-2 rounded-lg border-2 whitespace-nowrap text-sm ${activeStudentId === c.student_id ? 'border-brown-600 bg-brown-50' : 'border-cream-300'}`}
            >
              {c.student?.first_name} {c.student?.last_name}
            </button>
          ))}
        </div>
      )}

      {slots && slots.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {DAYS.map((day) => (
            <div key={day.value} className="card">
              <h3 className="font-semibold text-brown-800 mb-3">{day.label}</h3>
              <div className="space-y-2">
                {slots.filter((s: any) => s.day_of_week === day.value).length === 0 ? (
                  <p className="text-xs text-brown-300">No classes</p>
                ) : (
                  slots
                    .filter((s: any) => s.day_of_week === day.value)
                    .map((s: any) => (
                      <div key={s.id} className="p-2 rounded-lg bg-cream-100 text-sm">
                        <p className="font-medium text-brown-700">{s.classroom?.subject?.name}</p>
                        {role === 'teacher' && (
                          <p className="text-brown-400 text-xs">{s.classroom?.class?.name} {s.classroom?.class?.arm}</p>
                        )}
                        <p className="text-brown-400 text-xs">{s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}</p>
                        {role !== 'teacher' && (
                          <p className="text-brown-400 text-xs">{s.classroom?.teacher?.first_name} {s.classroom?.teacher?.last_name}</p>
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Clock} title="No timetable set yet" description="Your school hasn't set up a schedule for this class yet." />
      )}
    </div>
  )
}
