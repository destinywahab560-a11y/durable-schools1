import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, EmptyState } from '@/components/ui'
import toast from 'react-hot-toast'
import { ArrowRight, GraduationCap } from 'lucide-react'

export default function AdminPromotion() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id
  const queryClient = useQueryClient()

  const [sourceClassId, setSourceClassId] = useState('')
  const [destClassId, setDestClassId] = useState('')
  const [targetSessionId, setTargetSessionId] = useState('')
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [promoting, setPromoting] = useState(false)
  const [result, setResult] = useState<{ promoted: number } | null>(null)

  const { data: classes } = useQuery({
    queryKey: ['classes', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('*').eq('school_id', schoolId).order('name')
      return data ?? []
    },
    enabled: !!schoolId
  })

  const { data: sessions } = useQuery({
    queryKey: ['sessions', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('academic_sessions').select('*').eq('school_id', schoolId).order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!schoolId
  })

  const { data: studentsInSource, isLoading } = useQuery({
    queryKey: ['students-in-class', sourceClassId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_enrollments')
        .select('id, student_id, admission_number, student:profiles!student_id(first_name, last_name)')
        .eq('class_id', sourceClassId)
      if (error) { console.error('Fetch students-in-class error:', error); throw error }
      const list = data ?? []
      setSelectedStudentIds(list.map((s) => s.id))
      return list
    },
    enabled: !!sourceClassId
  })

  const toggleStudent = (enrollmentId: string) => {
    setSelectedStudentIds((prev) => (prev.includes(enrollmentId) ? prev.filter((id) => id !== enrollmentId) : [...prev, enrollmentId]))
  }

  const handlePromote = async () => {
    if (!destClassId || !targetSessionId) { toast.error('Pick a destination class and target session first.'); return }
    if (selectedStudentIds.length === 0) { toast.error('Select at least one student to promote.'); return }
    if (destClassId === sourceClassId) { toast.error('Destination class is the same as the source class.'); return }

    setPromoting(true)
    const { error, count } = await supabase
      .from('student_enrollments')
      .update({ class_id: destClassId, session_id: targetSessionId }, { count: 'exact' })
      .in('id', selectedStudentIds)
    setPromoting(false)

    if (error) { toast.error(error.message); return }
    setResult({ promoted: count ?? selectedStudentIds.length })
    queryClient.invalidateQueries({ queryKey: ['students-in-class', sourceClassId] })
    queryClient.invalidateQueries({ queryKey: ['students', schoolId] })
  }

  const reset = () => {
    setSourceClassId('')
    setDestClassId('')
    setTargetSessionId('')
    setSelectedStudentIds([])
    setResult(null)
  }

  return (
    <div>
      <PageHeader title="Bulk Promotion" subtitle="Move an entire class up to a new class and session in one action" />

      {result ? (
        <div className="card text-center py-10">
          <GraduationCap className="w-10 h-10 text-sage-500 mx-auto mb-3" />
          <p className="text-xl font-bold text-brown-800 mb-1">{result.promoted} student(s) promoted</p>
          <p className="text-sm text-brown-500 mb-6">Their grades and attendance from before stay exactly as they were — only their current class and session changed.</p>
          <button className="btn btn-primary" onClick={reset}>Promote Another Class</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 items-end">
            <div>
              <label className="label">From (current class)</label>
              <select value={sourceClassId} onChange={(e) => setSourceClassId(e.target.value)} className="input">
                <option value="">Select class...</option>
                {classes?.map((c) => <option key={c.id} value={c.id}>{c.name} {c.arm}{c.stream ? ` (${c.stream})` : ''}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="w-6 h-6 text-brown-300" />
            </div>
            <div>
              <label className="label">To (new class)</label>
              <select value={destClassId} onChange={(e) => setDestClassId(e.target.value)} className="input">
                <option value="">Select class...</option>
                {classes?.map((c) => <option key={c.id} value={c.id}>{c.name} {c.arm}{c.stream ? ` (${c.stream})` : ''}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-6 max-w-xs">
            <label className="label">Target Session</label>
            <select value={targetSessionId} onChange={(e) => setTargetSessionId(e.target.value)} className="input">
              <option value="">Select session...</option>
              {sessions?.map((s) => (
                <option key={s.id} value={s.id}>{s.session_name} — {s.term}{s.is_current ? ' (Current)' : ''}</option>
              ))}
            </select>
          </div>

          {!sourceClassId ? (
            <EmptyState icon={GraduationCap} title="Pick a class to promote" description="Select the class whose students are moving up." />
          ) : isLoading ? (
            <Spinner />
          ) : studentsInSource && studentsInSource.length > 0 ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-brown-800">{studentsInSource.length} student(s) in this class</h3>
                <p className="text-sm text-brown-400">{selectedStudentIds.length} selected</p>
              </div>
              <div className="space-y-1 max-h-96 overflow-y-auto mb-4">
                {studentsInSource.map((s: any) => (
                  <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-cream-100 cursor-pointer">
                    <input type="checkbox" checked={selectedStudentIds.includes(s.id)} onChange={() => toggleStudent(s.id)} />
                    <span className="text-brown-700">{s.student?.first_name} {s.student?.last_name}</span>
                    <span className="text-xs text-brown-400 ml-auto">{s.admission_number}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-brown-400 mb-3">Uncheck any student who's repeating this class instead of moving up.</p>
              <button className="btn btn-primary w-full" onClick={handlePromote} disabled={promoting}>
                {promoting ? 'Promoting...' : `Promote ${selectedStudentIds.length} Student(s)`}
              </button>
            </div>
          ) : (
            <EmptyState icon={GraduationCap} title="No students in this class" description="This class has no enrolled students to promote." />
          )}
        </>
      )}
    </div>
  )
}
