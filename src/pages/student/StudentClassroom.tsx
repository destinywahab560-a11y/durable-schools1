import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, Spinner, EmptyState } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { FileText, Link as LinkIcon, Video, BookOpen } from 'lucide-react'

export default function StudentClassroom() {
  const { id } = useParams<{ id: string }>()

  const { data: classroom, isLoading } = useQuery({
    queryKey: ['student-classroom', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('classrooms')
        .select('id, name, description, subject:subjects(name), teacher:profiles(first_name, last_name)')
        .eq('id', id)
        .maybeSingle()
      return data
    },
    enabled: !!id
  })

  const { data: materials } = useQuery({
    queryKey: ['materials', id],
    queryFn: async () => {
      const { data } = await supabase.from('materials').select('*').eq('classroom_id', id).order('week', { ascending: true })
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

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title={classroom?.subject?.name ?? 'Classroom'} subtitle={`Teacher: ${classroom?.teacher?.first_name} ${classroom?.teacher?.last_name}`} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-brown-800 mb-4">Learning Materials</h3>
          {materials && materials.length > 0 ? (
            <div className="space-y-3">
              {materials.map((m) => (
                <div key={m.id} className="card flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brown-100 text-brown-600 flex items-center justify-center">
                      {m.external_url ? <LinkIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-semibold text-brown-800">{m.title}</p>
                      <p className="text-sm text-brown-400">{m.topic} • Week {m.week || '—'}</p>
                    </div>
                  </div>
                  {(m.file_url || m.external_url) && (
                    <a href={m.file_url || m.external_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline text-sm">
                      {m.external_url ? 'Open' : 'Download'}
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={BookOpen} title="No materials yet" description="Materials will appear here once your teacher uploads them." />
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-brown-800 mb-4">Live Classes</h3>
          {liveClasses && liveClasses.length > 0 ? (
            <div className="space-y-3">
              {liveClasses.map((lc) => (
                <div key={lc.id} className="card flex items-center justify-between">
                  <div className="flex items-center gap-3">
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
                    {lc.meeting_url && lc.status !== 'ended' && (
                      <a href={lc.meeting_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-sm">Join</a>
                    )}
                    {lc.recording_url && (
                      <a href={lc.recording_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-sm">Recording</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Video} title="No live classes" description="Scheduled live lessons will appear here." />
          )}
        </div>
      </div>
    </div>
  )
}
