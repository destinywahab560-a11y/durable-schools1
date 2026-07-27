import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Modal, Spinner, EmptyState, ConfirmDialog } from '@/components/ui'
import toast from 'react-hot-toast'
import { Clock, Plus, Trash2 } from 'lucide-react'

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' }
]

export default function AdminTimetable() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id
  const queryClient = useQueryClient()

  const [selectedClassId, setSelectedClassId] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ classroom_id: '', day_of_week: '1', start_time: '08:00', end_time: '09:00' })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: classes } = useQuery({
    queryKey: ['classes', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('*').eq('school_id', schoolId).order('name')
      return data ?? []
    },
    enabled: !!schoolId
  })

  const { data: classroomsForClass } = useQuery({
    queryKey: ['classrooms-for-class', selectedClassId],
    queryFn: async () => {
      const { data } = await supabase
        .from('classrooms')
        .select('id, name, subject:subjects(name), teacher:profiles!teacher_id(first_name, last_name)')
        .eq('class_id', selectedClassId)
      return data ?? []
    },
    enabled: !!selectedClassId
  })

  const { data: slots, isLoading } = useQuery({
    queryKey: ['timetable-slots', selectedClassId],
    queryFn: async () => {
      const classroomIds = (classroomsForClass ?? []).map((c) => c.id)
      if (classroomIds.length === 0) return []
      const { data, error } = await supabase
        .from('timetable_slots')
        .select('id, day_of_week, start_time, end_time, classroom:classrooms(name, subject:subjects(name), teacher:profiles!teacher_id(first_name, last_name))')
        .in('classroom_id', classroomIds)
        .order('start_time')
      if (error) { console.error('Fetch timetable error:', error); throw error }
      return data ?? []
    },
    enabled: !!classroomsForClass
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('timetable_slots').insert({
      classroom_id: form.classroom_id,
      day_of_week: parseInt(form.day_of_week),
      start_time: form.start_time,
      end_time: form.end_time
    })
    if (error) { toast.error(error.message); return }
    toast.success('Slot added')
    setModalOpen(false)
    setForm({ classroom_id: '', day_of_week: '1', start_time: '08:00', end_time: '09:00' })
    queryClient.invalidateQueries({ queryKey: ['timetable-slots', selectedClassId] })
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const { error } = await supabase.from('timetable_slots').delete().eq('id', deleteId)
    if (error) { toast.error(error.message); return }
    toast.success('Slot removed')
    setDeleteId(null)
    queryClient.invalidateQueries({ queryKey: ['timetable-slots', selectedClassId] })
  }

  return (
    <div>
      <PageHeader title="Timetable" subtitle="Set the weekly schedule for each class"
        action={
          <button className="btn btn-primary" onClick={() => setModalOpen(true)} disabled={!selectedClassId}>
            <Plus className="w-4 h-4" /> Add Slot
          </button>
        } />

      <div className="mb-6">
        <label className="label">Class</label>
        <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="input max-w-xs">
          <option value="">Select a class...</option>
          {classes?.map((c) => (
            <option key={c.id} value={c.id}>{c.name} {c.arm}{c.stream ? ` (${c.stream})` : ''}</option>
          ))}
        </select>
      </div>

      {!selectedClassId ? (
        <EmptyState icon={Clock} title="Pick a class" description="Select a class above to view or edit its timetable." />
      ) : isLoading ? (
        <Spinner />
      ) : slots && slots.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {DAYS.map((day) => (
            <div key={day.value} className="card">
              <h3 className="font-semibold text-brown-800 mb-3">{day.label}</h3>
              <div className="space-y-2">
                {slots.filter((s: any) => s.day_of_week === day.value).length === 0 ? (
                  <p className="text-xs text-brown-300">No classes</p>
                ) : (
                  slots.filter((s: any) => s.day_of_week === day.value).map((s: any) => (
                    <div key={s.id} className="p-2 rounded-lg bg-cream-100 text-sm">
                      <div className="flex justify-between items-start">
                        <p className="font-medium text-brown-700">{s.classroom?.subject?.name}</p>
                        <button onClick={() => setDeleteId(s.id)} className="text-error-400 hover:text-error-600" aria-label="Remove slot">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-brown-400 text-xs">{s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}</p>
                      <p className="text-brown-400 text-xs">{s.classroom?.teacher?.first_name} {s.classroom?.teacher?.last_name}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Clock} title="No slots yet" description="Add the first class period for this class."
          action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Add Slot</button>} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Timetable Slot">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Subject / Teacher</label>
            <select required value={form.classroom_id} onChange={(e) => setForm({ ...form, classroom_id: e.target.value })} className="input">
              <option value="">Select...</option>
              {classroomsForClass?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.subject?.name} — {c.teacher?.first_name} {c.teacher?.last_name}</option>
              ))}
            </select>
            {classroomsForClass && classroomsForClass.length === 0 && (
              <p className="text-xs text-error-500 mt-1">This class has no assigned teachers yet — approve a teacher assignment first.</p>
            )}
          </div>
          <div>
            <label className="label">Day</label>
            <select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })} className="input">
              {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Time</label>
              <input type="time" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="time" required value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="input" />
            </div>
          </div>
          <button type="submit" className="btn btn-primary w-full">Add Slot</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Remove Slot"
        message="This removes this period from the timetable. This cannot be undone."
        confirmLabel="Remove"
        danger
      />
    </div>
  )
}
