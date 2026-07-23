import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, StatCard, Spinner, EmptyState } from '@/components/ui'
import { Users, GraduationCap, BookOpen, ClipboardCheck, School, TrendingUp } from 'lucide-react'

export default function AdminDashboard() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats', schoolId],
    queryFn: async () => {
      const [teachers, students, classes, subjects, parents] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'teacher'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'student'),
        supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
        supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'parent')
      ])
      return {
        teachers: teachers.count ?? 0,
        students: students.count ?? 0,
        classes: classes.count ?? 0,
        subjects: subjects.count ?? 0,
        parents: parents.count ?? 0
      }
    },
    enabled: !!schoolId
  })

  const { data: recentEnrollments } = useQuery({
    queryKey: ['recent-enrollments', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_enrollments')
        .select('id, admission_number, created_at, student:profiles(first_name, last_name), class:classes(name, arm)')
        .order('created_at', { ascending: false })
        .limit(5)
      return data ?? []
    },
    enabled: !!schoolId
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="School Dashboard" subtitle="Overview of your school at a glance" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Teachers" value={stats?.teachers ?? 0} icon={Users} color="brown" />
        <StatCard label="Students" value={stats?.students ?? 0} icon={GraduationCap} color="amber" />
        <StatCard label="Classes" value={stats?.classes ?? 0} icon={School} color="sage" />
        <StatCard label="Subjects" value={stats?.subjects ?? 0} icon={BookOpen} color="brown" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-brown-800 mb-4">Recent Enrollments</h3>
          {recentEnrollments && recentEnrollments.length > 0 ? (
            <div className="space-y-3">
              {recentEnrollments.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-cream-200 last:border-0">
                  <div>
                    <p className="font-medium text-brown-700">{e.student?.first_name} {e.student?.last_name}</p>
                    <p className="text-sm text-brown-400">{e.class?.name} {e.class?.arm}</p>
                  </div>
                  <span className="badge badge-amber">{e.admission_number || '—'}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Users} title="No enrollments yet" description="Students will appear here once enrolled." />
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-brown-800 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <a href="/admin/classes" className="p-4 rounded-lg bg-cream-100 hover:bg-cream-200 transition-colors text-center">
              <School className="w-6 h-6 mx-auto mb-2 text-brown-500" />
              <p className="text-sm font-medium text-brown-700">Manage Classes</p>
            </a>
            <a href="/admin/staff" className="p-4 rounded-lg bg-cream-100 hover:bg-cream-200 transition-colors text-center">
              <Users className="w-6 h-6 mx-auto mb-2 text-brown-500" />
              <p className="text-sm font-medium text-brown-700">Manage Staff</p>
            </a>
            <a href="/admin/students" className="p-4 rounded-lg bg-cream-100 hover:bg-cream-200 transition-colors text-center">
              <GraduationCap className="w-6 h-6 mx-auto mb-2 text-brown-500" />
              <p className="text-sm font-medium text-brown-700">Enroll Students</p>
            </a>
            <a href="/admin/fees" className="p-4 rounded-lg bg-cream-100 hover:bg-cream-200 transition-colors text-center">
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-brown-500" />
              <p className="text-sm font-medium text-brown-700">Fees & Billing</p>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
