import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, EmptyState } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { ClipboardCheck } from 'lucide-react'

export default function ParentAttendance() {
  const { profile } = useAuthStore()
  const parentId = profile?.id
  const [selectedChild, setSelectedChild] = useState<string | null>(null)

  const { data: children } = useQuery({
    queryKey: ['my-children', parentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_enrollments')
        .select('student_id, student:profiles(first_name, last_name)')
        .eq('parent_id', parentId)
      return data ?? []
    },
    enabled: !!parentId
  })

  const activeChildId = selectedChild || children?.[0]?.student_id

  const { data: attendance, isLoading } = useQuery({
    queryKey: ['child-attendance-full', activeChildId],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('id, date, status, note, subject:subjects(name)')
        .eq('student_id', activeChildId)
        .order('date', { ascending: false })
      return data ?? []
    },
    enabled: !!activeChildId
  })

  if (isLoading) return <Spinner />

  const present = attendance?.filter((a) => a.status === 'present').length ?? 0
  const absent = attendance?.filter((a) => a.status === 'absent').length ?? 0
  const late = attendance?.filter((a) => a.status === 'late').length ?? 0
  const excused = attendance?.filter((a) => a.status === 'excused').length ?? 0
  const total = attendance?.length ?? 0
  const rate = total > 0 ? Math.round((present / total) * 100) : 0

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Track your child's attendance record" />

      {children && children.length > 1 && (
        <div className="flex gap-3 mb-6">
          {children.map((c) => (
            <button
              key={c.student_id}
              onClick={() => setSelectedChild(c.student_id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeChildId === c.student_id ? 'bg-brown-600 text-cream-100' : 'bg-cream-200 text-brown-400'
              }`}
            >
              {c.student?.first_name} {c.student?.last_name}
            </button>
          ))}
        </div>
      )}

      {attendance && attendance.length > 0 ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card text-center">
              <p className="text-sm text-brown-400">Attendance Rate</p>
              <p className="text-3xl font-bold text-sage-500">{rate}%</p>
            </div>
            <div className="card text-center">
              <p className="text-sm text-brown-400">Present</p>
              <p className="text-3xl font-bold text-sage-500">{present}</p>
            </div>
            <div className="card text-center">
              <p className="text-sm text-brown-400">Absent</p>
              <p className="text-3xl font-bold text-error-500">{absent}</p>
            </div>
            <div className="card text-center">
              <p className="text-sm text-brown-400">Late</p>
              <p className="text-3xl font-bold text-amber-600">{late}</p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-brown-800 mb-4">Attendance History</h3>
            <div className="space-y-2">
              {attendance.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-cream-200 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-brown-700">{formatDate(a.date)}</p>
                    {a.subject && <p className="text-xs text-brown-400">{a.subject.name}</p>}
                  </div>
                  <span className={`badge ${
                    a.status === 'present' ? 'badge-sage' :
                    a.status === 'absent' ? 'badge-error' :
                    a.status === 'late' ? 'badge-amber' : 'badge-brown'
                  }`}>{a.status}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <EmptyState icon={ClipboardCheck} title="No attendance records" description="Attendance will appear here once recorded." />
      )}
    </div>
  )
}
