import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, EmptyState, ConfirmDialog } from '@/components/ui'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { ClipboardCheck, Check, X, Clock, Trash2 } from 'lucide-react'

export default function AdminAssignments() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id
  const queryClient = useQueryClient()

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['assignments', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('teacher_assignments')
        .select(`
          id, status, created_at, teacher_id, class_id, subject_id,
          teacher:profiles!teacher_assignments_teacher_id_fkey(first_name, last_name),
          class:classes(name, arm, stream),
          subject:subjects(name)
        `)
        .order('created_at', { ascending: false })
      return (data as any[]) ?? []
    },
    enabled: !!schoolId
  })

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('teacher_assignments').update({ status }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success(`Assignment ${status}`)
    queryClient.invalidateQueries({ queryKey: ['assignments', schoolId] })

    if (status === 'approved') {
      const assignment = assignments?.find((a: any) => a.id === id)
      if (assignment) {
        await supabase.from('classrooms').insert({
          school_id: schoolId,
          class_id: assignment.class_id,
          subject_id: assignment.subject_id,
          teacher_id: assignment.teacher_id,
          name: `${assignment.subject?.name} — ${assignment.class?.name}${assignment.class?.arm}`
        }).then(({ error: clsErr }) => {
          if (clsErr && !clsErr.message.includes('duplicate')) console.error(clsErr)
        })
      }
    }
  }

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const handleDelete = async () => {
    if (!deleteId) return
    const assignment = assignments?.find((a: any) => a.id === deleteId)
    if (assignment?.status === 'approved') {
      // Also remove the classroom this assignment created, so access is
      // actually revoked, not just hidden from this list.
      await supabase.from('classrooms')
        .delete()
        .eq('class_id', assignment.class_id)
        .eq('subject_id', assignment.subject_id)
        .eq('teacher_id', assignment.teacher_id)
    }
    const { error } = await supabase.from('teacher_assignments').delete().eq('id', deleteId)
    if (error) { toast.error(error.message); return }
    toast.success('Assignment deleted')
    setDeleteId(null)
    queryClient.invalidateQueries({ queryKey: ['assignments', schoolId] })
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="Teacher Assignments" subtitle="Approve teacher-subject-class assignments" />

      {assignments && assignments.length > 0 ? (
        <div className="space-y-3">
          {assignments.map((a: any) => (
            <div key={a.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  a.status === 'approved' ? 'bg-sage-100 text-sage-500' :
                  a.status === 'rejected' ? 'bg-error-100 text-error-500' :
                  'bg-amber-100 text-amber-600'
                )}>
                  {a.status === 'approved' ? <Check className="w-5 h-5" /> :
                   a.status === 'rejected' ? <X className="w-5 h-5" /> :
                   <Clock className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-semibold text-brown-800">
                    {a.teacher?.first_name} {a.teacher?.last_name}
                  </p>
                  <p className="text-sm text-brown-400">
                    {a.subject?.name} — {a.class?.name} {a.class?.arm}{a.class?.stream ? ` (${a.class.stream})` : ''}
                  </p>
                </div>
              </div>
              {a.status === 'pending' && (
                <div className="flex gap-2">
                  <button className="btn btn-secondary text-sm" onClick={() => updateStatus(a.id, 'approved')}>
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button className="btn btn-ghost text-sm text-error-600" onClick={() => updateStatus(a.id, 'rejected')}>
                    <X className="w-4 h-4" /> Reject
                  </button>
                  <button onClick={() => setDeleteId(a.id)} className="p-2 rounded-lg hover:bg-error-50 text-error-500" aria-label="Delete assignment">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              {a.status !== 'pending' && (
                <div className="flex items-center gap-2">
                  <span className={cn('badge', a.status === 'approved' ? 'badge-sage' : 'badge-error')}>
                    {a.status}
                  </span>
                  <button onClick={() => setDeleteId(a.id)} className="p-2 rounded-lg hover:bg-error-50 text-error-500" aria-label="Delete assignment">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={ClipboardCheck} title="No assignments yet" description="Teachers can request subject-class assignments from their dashboard." />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Assignment"
        message="If this assignment was approved, this also revokes the teacher's access to that classroom (materials, gradebook, attendance). This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
