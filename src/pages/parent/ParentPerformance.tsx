import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, EmptyState } from '@/components/ui'
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

export default function ParentPerformance() {
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

  const { data: results, isLoading } = useQuery({
    queryKey: ['child-performance', activeChildId],
    queryFn: async () => {
      const { data } = await supabase
        .from('gradebook')
        .select(`
          id, ca_score, exam_score, total_score, grade, teacher_remark, updated_at,
          subject:subjects(name)
        `)
        .eq('student_id', activeChildId)
        .eq('is_released', true)
        .order('updated_at', { ascending: true })
      return data ?? []
    },
    enabled: !!activeChildId
  })

  if (isLoading) return <Spinner />

  const chartData = results?.map((r: any) => ({
    subject: r.subject?.name?.substring(0, 10) || '',
    score: r.total_score || 0
  })) ?? []

  return (
    <div>
      <PageHeader title="Performance" subtitle="Track academic progress over time" />

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

      {results && results.length > 0 ? (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-brown-800 mb-4">Subject Performance</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFDDB8" />
                <XAxis dataKey="subject" tick={{ fill: '#6B4423', fontSize: 12 }} />
                <YAxis tick={{ fill: '#6B4423', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#FAF5EB', border: '1px solid #EFDDB8', borderRadius: '8px' }} />
                <Bar dataKey="score" fill="#8B5E3C" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-brown-800 mb-4">Detailed Results</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-cream-300">
                    <th className="text-left py-3 px-2 text-sm font-semibold text-brown-600">Subject</th>
                    <th className="text-center py-3 px-2 text-sm font-semibold text-brown-600">CA (40)</th>
                    <th className="text-center py-3 px-2 text-sm font-semibold text-brown-600">Exam (60)</th>
                    <th className="text-center py-3 px-2 text-sm font-semibold text-brown-600">Total</th>
                    <th className="text-center py-3 px-2 text-sm font-semibold text-brown-600">Grade</th>
                    <th className="text-left py-3 px-2 text-sm font-semibold text-brown-600">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r: any) => (
                    <tr key={r.id} className="border-b border-cream-200 last:border-0">
                      <td className="py-3 px-2 text-sm font-medium text-brown-700">{r.subject?.name}</td>
                      <td className="py-3 px-2 text-center text-sm text-brown-600">{r.ca_score}</td>
                      <td className="py-3 px-2 text-center text-sm text-brown-600">{r.exam_score}</td>
                      <td className="py-3 px-2 text-center text-sm font-bold text-brown-800">{r.total_score}</td>
                      <td className="py-3 px-2 text-center"><span className="badge badge-amber">{r.grade}</span></td>
                      <td className="py-3 px-2 text-sm text-brown-500">{r.teacher_remark || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState icon={BarChart3} title="No performance data" description="Results will appear here once released." />
      )}
    </div>
  )
}
