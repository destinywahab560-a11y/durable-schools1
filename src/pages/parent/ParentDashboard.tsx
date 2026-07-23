import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, EmptyState, StatCard } from '@/components/ui'
import { getInitials, gradeFromScore } from '@/lib/utils'
import { Users, BarChart3, ClipboardCheck, DollarSign, GraduationCap } from 'lucide-react'

export default function ParentDashboard() {
  const { profile } = useAuthStore()
  const parentId = profile?.id
  const [selectedChild, setSelectedChild] = useState<string | null>(null)

  const { data: children, isLoading } = useQuery({
    queryKey: ['my-children', parentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_enrollments')
        .select(`
          student_id,
          student:profiles(id, first_name, last_name, email),
          class:classes(name, arm, stream),
          admission_number
        `)
        .eq('parent_id', parentId)
      return data ?? []
    },
    enabled: !!parentId
  })

  const activeChildId = selectedChild || children?.[0]?.student_id

  const { data: results } = useQuery({
    queryKey: ['child-results', activeChildId],
    queryFn: async () => {
      const { data } = await supabase
        .from('gradebook')
        .select('id, total_score, grade, subject:subjects(name), is_released')
        .eq('student_id', activeChildId)
        .eq('is_released', true)
        .order('updated_at', { ascending: false })
      return data ?? []
    },
    enabled: !!activeChildId
  })

  const { data: attendance } = useQuery({
    queryKey: ['child-attendance', activeChildId],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('id, date, status')
        .eq('student_id', activeChildId)
        .order('date', { ascending: false })
        .limit(30)
      return data ?? []
    },
    enabled: !!activeChildId
  })

  const { data: invoices } = useQuery({
    queryKey: ['child-invoices', activeChildId],
    queryFn: async () => {
      const { data } = await supabase
        .from('invoices')
        .select('id, amount, status, due_date')
        .eq('student_id', activeChildId)
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!activeChildId
  })

  if (isLoading) return <Spinner />

  const presentCount = attendance?.filter((a) => a.status === 'present').length ?? 0
  const absentCount = attendance?.filter((a) => a.status === 'absent').length ?? 0
  const pendingInvoices = invoices?.filter((i) => i.status === 'pending').length ?? 0

  return (
    <div>
      <PageHeader title="Parent Dashboard" subtitle="Monitor your children's progress" />

      {/* Child switcher */}
      {children && children.length > 1 && (
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          {children.map((c) => (
            <button
              key={c.student_id}
              onClick={() => setSelectedChild(c.student_id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all whitespace-nowrap ${
                activeChildId === c.student_id ? 'border-brown-600 bg-brown-50' : 'border-cream-300 hover:border-brown-300'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-amber-400 text-brown-800 flex items-center justify-center text-sm font-semibold">
                {getInitials(`${c.student?.first_name} ${c.student?.last_name}`)}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-brown-700">{c.student?.first_name} {c.student?.last_name}</p>
                <p className="text-xs text-brown-400">{c.class?.name} {c.class?.arm}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {children && children.length > 0 ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Subjects" value={results?.length ?? 0} icon={BarChart3} color="brown" />
            <StatCard label="Present" value={presentCount} icon={ClipboardCheck} color="sage" />
            <StatCard label="Absent" value={absentCount} icon={ClipboardCheck} color="error" />
            <StatCard label="Pending Fees" value={pendingInvoices} icon={DollarSign} color="amber" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-brown-800 mb-4">Recent Results</h3>
              {results && results.length > 0 ? (
                <div className="space-y-3">
                  {results.slice(0, 5).map((r: any) => (
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
                <EmptyState icon={BarChart3} title="No results yet" description="Results will appear once released by the teacher." />
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-brown-800 mb-4">Recent Attendance</h3>
              {attendance && attendance.length > 0 ? (
                <div className="space-y-2">
                  {attendance.slice(0, 10).map((a) => (
                    <div key={a.id} className="card flex items-center justify-between py-2.5">
                      <p className="text-sm text-brown-600">{new Date(a.date).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                      <span className={`badge ${
                        a.status === 'present' ? 'badge-sage' :
                        a.status === 'absent' ? 'badge-error' :
                        a.status === 'late' ? 'badge-amber' : 'badge-brown'
                      }`}>{a.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={ClipboardCheck} title="No attendance records" description="Attendance will appear here once recorded." />
              )}
            </div>
          </div>
        </>
      ) : (
        <EmptyState icon={Users} title="No linked children" description="Contact your school administrator to link your child's account." />
      )}
    </div>
  )
}
