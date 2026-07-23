import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, EmptyState, StatCard } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { BookOpen, ClipboardList, FileText, ArrowRight, Calendar, Award } from 'lucide-react'

export default function StudentDashboard() {
  const { profile } = useAuthStore()
  const studentId = profile?.id

  const { data: enrollment } = useQuery({
    queryKey: ['my-enrollment', studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_enrollments')
        .select('id, admission_number, class:classes(id, name, arm, stream)')
        .eq('student_id', studentId)
        .maybeSingle()
      return data
    },
    enabled: !!studentId
  })

  const { data: classrooms, isLoading } = useQuery({
    queryKey: ['student-classrooms', studentId],
    queryFn: async () => {
      if (!enrollment?.class?.id) return []
      const { data } = await supabase
        .from('classrooms')
        .select(`
          id, name,
          subject:subjects(name),
          teacher:profiles(first_name, last_name)
        `)
        .eq('class_id', enrollment.class.id)
      return data ?? []
    },
    enabled: !!enrollment?.class?.id
  })

  const { data: assessments } = useQuery({
    queryKey: ['student-assessments', studentId],
    queryFn: async () => {
      if (!enrollment?.class?.id) return []
      const { data } = await supabase
        .from('assessments')
        .select(`
          id, title, type, open_at, close_at, is_published,
          classroom:classrooms(name)
        `)
        .eq('is_published', true)
        .in('classroom_id', classrooms?.map((c) => c.id) ?? [])
        .order('open_at', { ascending: true })
      return data ?? []
    },
    enabled: !!classrooms && classrooms.length > 0
  })

  const { data: recentResults } = useQuery({
    queryKey: ['student-recent-results', studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('gradebook')
        .select('id, total_score, grade, subject:subjects(name), is_released')
        .eq('student_id', studentId)
        .eq('is_released', true)
        .order('updated_at', { ascending: false })
        .limit(5)
      return data ?? []
    },
    enabled: !!studentId
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="My Dashboard" subtitle={`${enrollment?.class?.name} ${enrollment?.class?.arm}${enrollment?.class?.stream ? ` (${enrollment.class.stream})` : ''}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="My Subjects" value={classrooms?.length ?? 0} icon={BookOpen} color="brown" />
        <StatCard label="Upcoming" value={assessments?.length ?? 0} icon={ClipboardList} color="amber" />
        <StatCard label="Results" value={recentResults?.length ?? 0} icon={FileText} color="sage" />
        <StatCard label="Adm No" value={enrollment?.admission_number ?? '—'} icon={Award} color="brown" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-brown-800 mb-4">My Subjects</h3>
          {classrooms && classrooms.length > 0 ? (
            <div className="space-y-3">
              {classrooms.map((c) => (
                <Link key={c.id} to={`/student/classroom/${c.id}`} className="card flex items-center justify-between group hover:shadow-md transition-shadow">
                  <div>
                    <p className="font-semibold text-brown-800">{c.subject?.name}</p>
                    <p className="text-sm text-brown-400">{c.teacher?.first_name} {c.teacher?.last_name}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-brown-300 group-hover:text-brown-600 transition-colors" />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={BookOpen} title="No subjects yet" description="Your subjects will appear here once set up." />
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-brown-800 mb-4">Upcoming Assessments</h3>
          {assessments && assessments.length > 0 ? (
            <div className="space-y-3">
              {assessments.map((a) => (
                <div key={a.id} className="card">
                  <p className="font-semibold text-brown-800">{a.title}</p>
                  <p className="text-sm text-brown-400">{a.type} • {a.classroom?.name}</p>
                  {a.open_at && <p className="text-xs text-brown-300 mt-1">Opens: {formatDate(a.open_at)}</p>}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Calendar} title="No upcoming assessments" description="Check back later for new quizzes and tests." />
          )}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold text-brown-800 mb-4">Recent Results</h3>
        {recentResults && recentResults.length > 0 ? (
          <div className="space-y-3">
            {recentResults.map((r) => (
              <div key={r.id} className="card flex items-center justify-between">
                <p className="font-medium text-brown-700">{r.subject?.name}</p>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-brown-800">{r.total_score}</span>
                  <span className="badge badge-amber">{r.grade}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={FileText} title="No results yet" description="Your results will appear here once released." />
        )}
      </div>
    </div>
  )
}
