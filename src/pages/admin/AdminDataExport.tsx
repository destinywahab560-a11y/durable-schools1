import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader } from '@/components/ui'
import Papa from 'papaparse'
import toast from 'react-hot-toast'
import { Download, Users, BarChart3, ClipboardCheck } from 'lucide-react'

function downloadCsv(filename: string, rows: Record<string, any>[]) {
  if (rows.length === 0) {
    toast.error('No data to export yet.')
    return
  }
  const csv = Papa.unparse(rows)
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminDataExport() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id

  const { data: classes } = useQuery({
    queryKey: ['classes', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('id, name, arm, stream').eq('school_id', schoolId)
      return data ?? []
    },
    enabled: !!schoolId
  })

  const { data: session } = useQuery({
    queryKey: ['current-session', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('academic_sessions').select('*').eq('school_id', schoolId).eq('is_current', true).maybeSingle()
      return data
    },
    enabled: !!schoolId
  })

  const classIds = (classes ?? []).map((c) => c.id)
  const classById = new Map((classes ?? []).map((c) => [c.id, c]))

  const exportStudents = async () => {
    const { data, error } = await supabase
      .from('student_enrollments')
      .select('admission_number, class_id, student:profiles!student_id(first_name, last_name, email, phone), parent:profiles!parent_id(first_name, last_name, email, phone)')
      .in('class_id', classIds)
    if (error) { toast.error(error.message); return }

    const rows = (data ?? []).map((e: any) => {
      const cls = classById.get(e.class_id)
      return {
        'Admission Number': e.admission_number ?? '',
        'First Name': e.student?.first_name ?? '',
        'Last Name': e.student?.last_name ?? '',
        'Email': e.student?.email ?? '',
        'Phone': e.student?.phone ?? '',
        'Class': cls ? `${cls.name} ${cls.arm}${cls.stream ? ` (${cls.stream})` : ''}` : '',
        'Parent Name': e.parent ? `${e.parent.first_name} ${e.parent.last_name}` : '',
        'Parent Email': e.parent?.email ?? '',
        'Parent Phone': e.parent?.phone ?? ''
      }
    })
    downloadCsv('students_export.csv', rows)
  }

  const exportGrades = async () => {
    if (!session?.id) { toast.error('No current session set — mark one as current first.'); return }
    const { data, error } = await supabase
      .from('gradebook')
      .select('student_id, class_id, ca_score, exam_score, total_score, grade, teacher_remark, subject:subjects(name), student:profiles!student_id(first_name, last_name)')
      .in('class_id', classIds)
      .eq('session_id', session.id)
    if (error) { toast.error(error.message); return }

    const rows = (data ?? []).map((g: any) => {
      const cls = classById.get(g.class_id)
      return {
        'Student': `${g.student?.first_name} ${g.student?.last_name}`,
        'Class': cls ? `${cls.name} ${cls.arm}` : '',
        'Subject': g.subject?.name ?? '',
        'CA Score': g.ca_score ?? '',
        'Exam Score': g.exam_score ?? '',
        'Total': g.total_score ?? '',
        'Grade': g.grade ?? '',
        'Remark': g.teacher_remark ?? ''
      }
    })
    downloadCsv(`grades_${session.session_name}_${session.term}.csv`.replace(/\s+/g, '_'), rows)
  }

  const exportAttendance = async () => {
    if (!session?.id) { toast.error('No current session set — mark one as current first.'); return }
    const { data, error } = await supabase
      .from('attendance')
      .select('student_id, class_id, date, status, student:profiles!student_id(first_name, last_name)')
      .in('class_id', classIds)
      .eq('session_id', session.id)
      .order('date')
    if (error) { toast.error(error.message); return }

    const rows = (data ?? []).map((a: any) => {
      const cls = classById.get(a.class_id)
      return {
        'Student': `${a.student?.first_name} ${a.student?.last_name}`,
        'Class': cls ? `${cls.name} ${cls.arm}` : '',
        'Date': a.date,
        'Status': a.status
      }
    })
    downloadCsv(`attendance_${session.session_name}_${session.term}.csv`.replace(/\s+/g, '_'), rows)
  }

  return (
    <div>
      <PageHeader title="Data Export" subtitle="Download your school's records as spreadsheets" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="w-10 h-10 rounded-lg bg-brown-100 text-brown-600 flex items-center justify-center mb-3">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-brown-800 mb-1">Students</h3>
          <p className="text-sm text-brown-400 mb-4">All students, their class, admission number, and linked parent contact details.</p>
          <button className="btn btn-primary w-full" onClick={exportStudents}>
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        <div className="card">
          <div className="w-10 h-10 rounded-lg bg-sage-100 text-sage-600 flex items-center justify-center mb-3">
            <BarChart3 className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-brown-800 mb-1">Grades</h3>
          <p className="text-sm text-brown-400 mb-4">All recorded grades for the current session — every class and subject.</p>
          <button className="btn btn-primary w-full" onClick={exportGrades}>
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        <div className="card">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-brown-800 mb-1">Attendance</h3>
          <p className="text-sm text-brown-400 mb-4">Every attendance record for the current session, across all classes.</p>
          <button className="btn btn-primary w-full" onClick={exportAttendance}>
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
    </div>
  )
}
