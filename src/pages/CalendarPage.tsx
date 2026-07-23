import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, EmptyState } from '@/components/ui'
import { formatDateTime, cn } from '@/lib/utils'
import { Calendar, Video, FileText, BookOpen, School, Sun } from 'lucide-react'

export default function CalendarPage() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id

  const { data: events, isLoading } = useQuery({
    queryKey: ['calendar-events', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('school_id', schoolId)
        .order('start_at', { ascending: true })
        .limit(50)
      return data ?? []
    },
    enabled: !!schoolId
  })

  if (isLoading) return <Spinner />

  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    live_class: Video,
    assessment: FileText,
    homework: BookOpen,
    school_event: School,
    holiday: Sun
  }

  const colorMap: Record<string, string> = {
    live_class: 'bg-amber-100 text-amber-600',
    assessment: 'bg-error-100 text-error-500',
    homework: 'bg-brown-100 text-brown-600',
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
