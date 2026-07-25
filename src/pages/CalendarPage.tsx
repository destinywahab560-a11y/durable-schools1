import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, EmptyState } from '@/components/ui'
import { formatDateTime, cn } from '@/lib/utils'
import { Calendar, Video, FileText, School, Sun } from 'lucide-react'

type CalendarEvent = {
  id: string
  title: string
  description?: string | null
  event_type: 'live_class' | 'assessment' | 'school_event' | 'holiday'
  start_at: string
}

export default function CalendarPage() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id
  const role = profile?.role

  // Figure out which classes are relevant to this person, so assessments
  // and live classes for other classes don't show up here. Admin sees
  // everything in their own branch (RLS handles that scoping already).
  const { data: myClassIds } = useQuery({
    queryKey: ['calendar-my-classes', profile?.id, role],
    queryFn: async () => {
      if (role === 'student') {
        const { data } = await supabase.from('student_enrollments').select('class_id').eq('student_id', profile?.id)
        return [...new Set((data ?? []).map((d) => d.class_id))]
      }
      if (role === 'parent') {
        const { data } = await supabase.from('student_enrollments').select('class_id').eq('parent_id', profile?.id)
        return [...new Set((data ?? []).map((d) => d.class_id))]
      }
      if (role === 'teacher') {
        const { data } = await supabase.from('teacher_assignments').select('class_id').eq('teacher_id', profile?.id).eq('status', 'approved')
        return [...new Set((data ?? []).map((d) => d.class_id))]
      }
      return null // admin: no class filter
    },
    enabled: !!profile?.id && !!role
  })

  const { data: classroomIds } = useQuery({
    queryKey: ['calendar-my-classrooms', myClassIds],
    queryFn: async () => {
      if (myClassIds === null) return null // admin: no filter
      if (!myClassIds || myClassIds.length === 0) return []
      const { data } = await supabase.from('classrooms').select('id').in('class_id', myClassIds)
      return (data ?? []).map((d) => d.id)
    },
    enabled: myClassIds !== undefined
  })

  const { data: events, isLoading } = useQuery({
    queryKey: ['calendar-events', schoolId, myClassIds, classroomIds],
    queryFn: async () => {
      const results: CalendarEvent[] = []

      const { data: announcements } = await supabase
        .from('announcements')
        .select('id, title, body, is_school_wide, target_class_id, created_at')
        .eq('school_id', schoolId)
      ;(announcements ?? []).forEach((a) => {
        if (a.is_school_wide || myClassIds === null || (a.target_class_id && myClassIds?.includes(a.target_class_id))) {
          results.push({ id: `announcement-${a.id}`, title: a.title, description: a.body, event_type: 'school_event', start_at: a.created_at })
        }
      })

      const { data: holidays } = await supabase
        .from('holiday_programs')
        .select('id, name, description, start_date')
        .eq('school_id', schoolId)
      ;(holidays ?? []).forEach((h) => {
        results.push({ id: `holiday-${h.id}`, title: h.name, description: h.description, event_type: 'holiday', start_at: h.start_date })
      })

      if (classroomIds === null || (classroomIds && classroomIds.length > 0)) {
        let assessmentsQuery = supabase
          .from('assessments')
          .select('id, title, type, open_at')
          .not('open_at', 'is', null)
        if (classroomIds) assessmentsQuery = assessmentsQuery.in('classroom_id', classroomIds)
        const { data: assessments } = await assessmentsQuery
        ;(assessments ?? []).forEach((a) => {
          results.push({ id: `assessment-${a.id}`, title: `${a.title} (${a.type})`, event_type: 'assessment', start_at: a.open_at })
        })

        let liveClassesQuery = supabase
          .from('live_classes')
          .select('id, title, scheduled_at, status')
          .neq('status', 'cancelled')
        if (classroomIds) liveClassesQuery = liveClassesQuery.in('classroom_id', classroomIds)
        const { data: liveClasses } = await liveClassesQuery
        ;(liveClasses ?? []).forEach((l) => {
          results.push({ id: `live-${l.id}`, title: l.title, event_type: 'live_class', start_at: l.scheduled_at })
        })
      }

      return results.sort((x, y) => new Date(x.start_at).getTime() - new Date(y.start_at).getTime())
    },
    enabled: !!schoolId && classroomIds !== undefined
  })

  if (isLoading) return <Spinner />

  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    live_class: Video,
    assessment: FileText,
    school_event: School,
    holiday: Sun
  }

  const colorMap: Record<string, string> = {
    live_class: 'bg-amber-100 text-amber-600',
    assessment: 'bg-error-100 text-error-500',
    school_event: 'bg-sage-100 text-sage-500',
    holiday: 'bg-cream-300 text-brown-500'
  }

  return (
    <div>
      <PageHeader title="Calendar" subtitle="All your events in one view" />

      {events && events.length > 0 ? (
        <div className="space-y-3">
          {events.map((e) => {
            const Icon = iconMap[e.event_type] || Calendar
            return (
              <div key={e.id} className="card flex items-center gap-4">
                <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center shrink-0', colorMap[e.event_type] || 'bg-cream-200 text-brown-500')}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-brown-800">{e.title}</p>
                  {e.description && <p className="text-sm text-brown-400">{e.description}</p>}
                  {e.start_at && <p className="text-xs text-brown-300 mt-1">{formatDateTime(e.start_at)}</p>}
                </div>
                <span className="badge badge-brown capitalize">{e.event_type.replace('_', ' ')}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState icon={Calendar} title="No events" description="School events, live classes, and assessment dates will appear here." />
      )}
    </div>
  )
}
