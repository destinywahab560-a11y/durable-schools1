import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, EmptyState } from '@/components/ui'
import { gradeFromScore } from '@/lib/utils'
import { FileText, Download, Award } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function StudentResults() {
  const { profile } = useAuthStore()
  const studentId = profile?.id

  const { data: enrollment } = useQuery({
    queryKey: ['my-enrollment', studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_enrollments')
        .select('id, admission_number, class:classes(name, arm, stream)')
        .eq('student_id', studentId)
        .maybeSingle()
      return data
    },
    enabled: !!studentId
  })

  const { data: results, isLoading } = useQuery({
    queryKey: ['my-results', studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('gradebook')
        .select(`
          id, ca_score, exam_score, total_score, grade, teacher_remark, is_released,
          subject:subjects(name)
        `)
        .eq('student_id', studentId)
        .eq('is_released', true)
        .order('updated_at', { ascending: false })
      return data ?? []
    },
    enabled: !!studentId
  })

  const { data: session } = useQuery({
    queryKey: ['current-session', profile?.school_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('academic_sessions')
        .select('*')
        .eq('school_id', profile?.school_id)
        .eq('is_current', true)
        .maybeSingle()
      return data
    },
    enabled: !!profile?.school_id
  })

  const downloadPDF = () => {
    if (!results || results.length === 0) return
    const doc = new jsPDF()
    const studentName = `${profile?.first_name} ${profile?.last_name}`
    const className = `${enrollment?.class?.name} ${enrollment?.class?.arm}${enrollment?.class?.stream ? ` (${enrollment.class.stream})` : ''}`

    doc.setFontSize(20)
    doc.text('Durable Schools', 105, 20, { align: 'center' })
    doc.setFontSize(12)
    doc.text('Report Card', 105, 30, { align: 'center' })
    doc.setFontSize(10)
    doc.text(`${session?.session_name || ''} — ${session?.term || ''}`, 105, 38, { align: 'center' })
    doc.line(20, 42, 190, 42)

    doc.setFontSize(11)
    doc.text(`Name: ${studentName}`, 20, 52)
    doc.text(`Class: ${className}`, 20, 60)
    doc.text(`Admission No: ${enrollment?.admission_number || '—'}`, 20, 68)

    autoTable(doc, {
      startY: 78,
      head: [['Subject', 'CA (40)', 'Exam (60)', 'Total', 'Grade', 'Remark']],
      body: results.map((r: any) => [
        r.subject?.name || '—',
        r.ca_score?.toString() || '0',
        r.exam_score?.toString() || '0',
        r.total_score?.toString() || '0',
        r.grade || '—',
        r.teacher_remark || '—'
      ])
    })

    const totalScore = results.reduce((sum: number, r: any) => sum + (r.total_score || 0), 0)
    const avgScore = results.length > 0 ? totalScore / results.length : 0
    const { grade, remark } = gradeFromScore(avgScore, 100)

    const finalY = (doc as any).lastAutoTable.finalY + 10
    doc.setFontSize(11)
    doc.text(`Total: ${totalScore}`, 20, finalY)
    doc.text(`Average: ${avgScore.toFixed(1)}`, 20, finalY + 8)
    doc.text(`Overall Grade: ${grade} (${remark})`, 20, finalY + 16)

    doc.setFontSize(8)
    doc.text('This is a computer-generated report card from Durable Schools.', 105, 280, { align: 'center' })

    doc.save(`${studentName.replace(' ', '_')}_Report_Card.pdf`)
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="My Results" subtitle="View and download your report card"
        action={results && results.length > 0 ? (
          <button className="btn btn-primary" onClick={downloadPDF}>
            <Download className="w-4 h-4" /> Download PDF
          </button>
        ) : undefined} />

      {results && results.length > 0 ? (
        <div className="card overflow-x-auto">
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
          <div className="mt-4 pt-4 border-t border-cream-300 flex items-center gap-6">
            <div>
              <p className="text-sm text-brown-400">Total Score</p>
              <p className="text-2xl font-bold text-brown-800">{results.reduce((s: number, r: any) => s + (r.total_score || 0), 0)}</p>
            </div>
            <div>
              <p className="text-sm text-brown-400">Average</p>
              <p className="text-2xl font-bold text-brown-800">{(results.reduce((s: number, r: any) => s + (r.total_score || 0), 0) / results.length).toFixed(1)}</p>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState icon={FileText} title="No results yet" description="Your results will appear here once your teacher releases them." />
      )}
    </div>
  )
}
