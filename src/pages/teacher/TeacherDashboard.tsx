import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Modal, Spinner, EmptyState, StatCard } from '@/components/ui'
import toast from 'react-hot-toast'
import { BookOpen, ClipboardList, Users, Plus, ArrowRight, ClipboardCheck } from 'lucide-react'

export default function TeacherDashboard() {
  const { profile } = useAuthStore()
  const teacherId = profile?.id
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ class_id: '', subject_id: '' })

  const { data: assignments } = useQuery({
    queryKey: ['my-assignments', teacherId],
    queryFn: async () => {
      const { data } = await supabase
        .from('teacher_assignments')
        .select(`
          id, status,
          class:classes(id, name, arm, stream),
          subject:subjects(id, name)
        `)
        .eq('teacher_id', teacherId)
        .eq('status', 'approved')
      return data ?? []
    },
    enabled: !!teacherId
  })

  const { data: totalStudents } = useQuery({
    queryKey: ['my-total-students', teacherId, assignments],
    queryFn: async () => {
      const classIds = [...new Set((assignments ?? []).map((a) => a.class?.id).filter(Boolean))]
      if (classIds.length === 0) return 0
      const { count } = await supabase
        .from('student_enrollments')
        .select('id', { count: 'exact', head: true })
        .in('class_id', classIds)
      return count ?? 0
    },
    enabled: !!assignments
  })

  const { data: classrooms, isLoading } = useQuery({
    queryKey: ['my-classrooms', teacherId],
    queryFn: async () => {
      const { data } = await supabase
        .from('classrooms')
        .select(`
          id, name, description,
          class:classes(name, arm, stream),
          subject:subjects(name)
        `)
        .eq('teacher_id', teacherId)
        .order('name')
      return data ?? []
    },
    enabled: !!teacherId
  })

  const { data: schoolClasses } = useQuery({
    queryKey: ['classes', profile?.school_id],
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('*').eq('school_id', profile?.school_id).order('name')
      return data ?? []
    },
    enabled: !!profile?.school_id
  })

  const { data: subjects } = useQuery({
    queryKey: ['subjects', profile?.school_id],
    queryFn: async () => {
      const { data } = await supabase.from('subjects').select('*').eq('school_id', profile?.school_id).order('name')
      return data ?? []
    },
    enabled: !!profile?.school_id
  })

  const { data: classSubjectLinks } = useQuery({
    queryKey: ['class-subjects-links', profile?.school_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('class_subjects')
        .select('class_id, subject_id')
        .in('class_id', (schoolClasses ?? []).map((c) => c.id))
      return data ?? []
    },
    enabled: !!schoolClasses && schoolClasses.length > 0
  })

  const subjectsForClass = (classId: string) => {
    if (!classId) return subjects ?? []
    const validSubjectIds = new Set((classSubjectLinks ?? []).filter((l) => l.class_id === classId).map((l) => l.subject_id))
    return (subjects ?? []).filter((s) => validSubjectIds.has(s.id))
  }

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('teacher_assignments').insert({
      teacher_id: teacherId,
      class_id: form.class_id,
      subject_id: form.subject_id
    })
    if (error) { toast.error(error.message); return }
    toast.success('Assignment requested — pending admin approval')
    setModalOpen(false)
    setForm({ class_id: '', subject_id: '' })
    queryClient.invalidateQueries({ queryKey: ['my-assignments', teacherId] })
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="Teacher Dashboard" subtitle="Your classes and teaching activities"
        action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Request Assignment</button>} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label="My Classrooms" value={classrooms?.length ?? 0} icon={BookOpen} color="brown" />
        <StatCard label="Approved Subjects" value={assignments?.length ?? 0} icon={ClipboardList} color="amber" />
        <StatCard label="Total Students" value={totalStudents ?? 0} icon={Users} color="sage" />
      </div>

      <h3 className="text-lg font-semibold text-brown-800 mb-4">My Classrooms</h3>
      {classrooms && classrooms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classrooms.map((c) => (
            <Link key={c.id} to={`/teacher/classroom/${c.id}`} className="card hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-brown-100 text-brown-600 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <ArrowRight className="w-5 h-5 text-brown-300 group-hover:text-brown-600 transition-colors" />
              </div>
              <p className="font-semibold text-brown-800">{c.subject?.name}</p>
              <p className="text-sm text-brown-400">{c.class?.name} {c.class?.arm}{c.class?.stream ? ` (${c.class.stream})` : ''}</p>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={ClipboardCheck} title="No classrooms yet" description="Request a subject-class assignment to get started."
          action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Request Assignment</button>} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Request Subject-Class Assignment">
        <form onSubmit={handleRequest} className="space-y-4">
          <div>
            <label className="label">Class</label>
            <select required value={form.class_id} onChange={(e) => setForm({ class_id: e.target.value, subject_id: '' })} className="input">
              <option value="">Select class...</option>
              {schoolClasses?.map((c) => <option key={c.id} value={c.id}>{c.name} {c.arm}{c.stream ? ` (${c.stream})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Subject</label>
            <select required value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} className="input" disabled={!form.class_id}>
              <option value="">{form.class_id ? 'Select subject...' : 'Pick a class first'}</option>
              {subjectsForClass(form.class_id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary w-full">Submit Request</button>
        </form>
      </Modal>
    </div>
  )
}
