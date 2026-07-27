import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, EmptyState } from '@/components/ui'
import { AlertTriangle, TrendingUp, Users } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

const AT_RISK_SCORE_THRESHOLD = 50
const AT_RISK_ATTENDANCE_THRESHOLD = 75 // percent

export default function AdminAnalytics() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id

  const { data: session } = useQuery({
    queryKey: ['current-session', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('academic_sessions').select('*').eq('school_id', schoolId).eq('is_current', true).maybeSingle()
      return data
    },
    enabled: !!schoolId
  })

  const { data: classes } = useQuery({
    queryKey: ['classes', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('id, name, arm').eq('school_id', schoolId)
      return data ?? []
    },
    enabled: !!schoolId
  })

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['admin-analytics', schoolId, session?.id],
    queryFn: async () => {
      const classIds = (classes ?? []).map((c) => c.id)
      if (classIds.length === 0 || !session?.id) return null

      const [gradesRes, attendanceRes, enrollmentsRes] = await Promise.all([
        supabase.from('gradebook').select('student_id, subject_id, total_score, subject:subjects(name)').in('class_id', classIds).eq('session_id', session.id),
        supabase.from('attendance').select('student_id, status').in('class_id', classIds).eq('session_id', session.id),
        supabase.from('student_enrollments').select('created_at').in('class_id', classIds)
      ])
      if (gradesRes.error) throw gradesRes.error
      if (attendanceRes.error) throw attendanceRes.error
      if (enrollmentsRes.error) throw enrollmentsRes.error

      const grades = gradesRes.data ?? []
      const attendance = attendanceRes.data ?? []
      const enrollments = enrollmentsRes.data ?? []

      const scoresByStudent = new Map<string, number[]>()
      grades.forEach((g) => {
        if (g.total_score == null) return
        const arr = scoresByStudent.get(g.student_id) ?? []
        arr.push(g.total_score)
        scoresByStudent.set(g.student_id, arr)
      })

      const attendanceByStudent = new Map<string, { present: number; total: number }>()
      attendance.forEach((a) => {
        const entry = attendanceByStudent.get(a.student_id) ?? { present: 0, total: 0 }
        entry.total++
        if (a.status === 'present') entry.present++
        attendanceByStudent.set(a.student_id, entry)
      })

      const atRiskStudentIds: string[] = []
      scoresByStudent.forEach((scores, studentId) => {
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
        const att = attendanceByStudent.get(studentId)
        const attRate = att && att.total > 0 ? (att.present / att.total) * 100 : 100
        if (avgScore < AT_RISK_SCORE_THRESHOLD && attRate < AT_RISK_ATTENDANCE_THRESHOLD) {
          atRiskStudentIds.push(studentId)
        }
      })

      let atRiskStudents: any[] = []
      if (atRiskStudentIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', atRiskStudentIds)
        atRiskStudents = (data ?? []).map((s) => {
          const scores = scoresByStudent.get(s.id) ?? []
          const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
          const att = attendanceByStudent.get(s.id)
          const attRate = att && att.total > 0 ? Math.round((att.present / att.total) * 100) : 100
          return { ...s, avgScore: Math.round(avgScore), attRate }
        })
      }

      const scoresBySubject = new Map<string, { name: string; scores: number[] }>()
      grades.forEach((g) => {
        if (g.total_score == null || !g.subject_id) return
        const entry = scoresBySubject.get(g.subject_id) ?? { name: (g.subject as any)?.name ?? 'Unknown', scores: [] }
        entry.scores.push(g.total_score)
        scoresBySubject.set(g.subject_id, entry)
      })
      const subjectPerformance = [...scoresBySubject.values()]
        .map((s) => ({ name: s.name, average: Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length) }))
        .sort((a, b) => a.average - b.average)

      const enrollmentsByMonth = new Map<string, number>()
      enrollments.forEach((e) => {
        const month = new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        enrollmentsByMonth.set(month, (enrollmentsByMonth.get(month) ?? 0) + 1)
      })
      const enrollmentTrend = [...enrollmentsByMonth.entries()].map(([month, count]) => ({ month, count }))

      return { atRiskStudents, subjectPerformance, enrollmentTrend }
    },
    enabled: !!schoolId && !!classes && !!session
  })

  if (isLoading) return <Spinner />

  if (!session) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="Performance and attendance insights" />
        <EmptyState icon={TrendingUp} title="No current session set" description="Mark a session as current under Sessions & Terms to see analytics." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Analytics" subtitle={`Performance and attendance insights — ${session.session_name} ${session.term}`} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-brown-800 mb-1 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-error-500" /> At-Risk Students
          </h3>
          <p className="text-xs text-brown-400 mb-4">Below {AT_RISK_SCORE_THRESHOLD}% average AND below {AT_RISK_ATTENDANCE_THRESHOLD}% attendance this term</p>
          {analytics?.atRiskStudents && analytics.atRiskStudents.length > 0 ? (
            <div className="space-y-2">
              {analytics.atRiskStudents.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-error-50">
                  <p className="font-medium text-brown-700">{s.first_name} {s.last_name}</p>
                  <div className="flex gap-2 text-xs">
                    <span className="badge badge-error">{s.avgScore}% avg</span>
                    <span className="badge badge-error">{s.attRate}% attendance</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Users} title="No at-risk students" description="Nobody currently meets both thresholds — good sign." />
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-brown-800 mb-4">Subject Performance</h3>
          {analytics?.subjectPerformance && analytics.subjectPerformance.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={analytics.subjectPerformance} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" width={90} />
                <Tooltip />
                <Bar dataKey="average" fill="#5C3A1E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={TrendingUp} title="No grades yet" description="Subject averages will appear once results are entered." />
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-brown-800 mb-4">Enrollment Trend</h3>
        {analytics?.enrollmentTrend && analytics.enrollmentTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={analytics.enrollmentTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#5C3A1E" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState icon={Users} title="No enrollment data yet" description="Trends will appear as students are enrolled over time." />
        )}
      </div>
    </div>
  )
}
