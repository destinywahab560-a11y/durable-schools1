import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Modal, Spinner, EmptyState, ConfirmDialog } from '@/components/ui'
import toast from 'react-hot-toast'
import { Heart, Search, Link2, Unlink, Trash2, Mail } from 'lucide-react'

export default function AdminParents() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [linkModalTarget, setLinkModalTarget] = useState<{ parentId: string; parentName: string } | null>(null)
  const [linkIdentifier, setLinkIdentifier] = useState('')
  const [unlinkTarget, setUnlinkTarget] = useState<{ enrollmentId: string; childName: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const { data: parents, isLoading } = useQuery({
    queryKey: ['parents', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, first_name, last_name, email, phone,
          enrollments:student_enrollments!parent_id(
            id,
            student:profiles!student_id(first_name, last_name),
            class:classes(name, arm, stream)
          )
        `)
        .eq('school_id', schoolId)
        .eq('role', 'parent')
        .order('created_at', { ascending: false })
      if (error) { console.error('Fetch parents error:', error); throw error }
      return data ?? []
    },
    enabled: !!schoolId
  })

  const handleLinkChild = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!linkModalTarget) return

    // Find the student by admission number or email, then link their
    // enrollment to this parent.
    const { data: enrollment } = await supabase
      .from('student_enrollments')
      .select('id, student:profiles!student_id(email)')
      .eq('admission_number', linkIdentifier)
      .maybeSingle()

    let targetEnrollmentId = enrollment?.id

    if (!targetEnrollmentId) {
      const { data: byEmail } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', linkIdentifier)
        .eq('role', 'student')
        .maybeSingle()
      if (byEmail) {
        const { data: enrollmentByStudent } = await supabase
          .from('student_enrollments')
          .select('id')
          .eq('student_id', byEmail.id)
          .maybeSingle()
        targetEnrollmentId = enrollmentByStudent?.id
      }
    }

    if (!targetEnrollmentId) {
      toast.error("Couldn't find a student with that admission number or email.")
      return
    }

    const { error } = await supabase.from('student_enrollments').update({ parent_id: linkModalTarget.parentId }).eq('id', targetEnrollmentId)
    if (error) { toast.error(error.message); return }
    toast.success('Child linked')
    setLinkModalTarget(null)
    setLinkIdentifier('')
    queryClient.invalidateQueries({ queryKey: ['parents', schoolId] })
  }

  const handleUnlink = async () => {
    if (!unlinkTarget) return
    const { error } = await supabase.from('student_enrollments').update({ parent_id: null }).eq('id', unlinkTarget.enrollmentId)
    if (error) { toast.error(error.message); setUnlinkTarget(null); return }
    toast.success('Child unlinked')
    setUnlinkTarget(null)
    queryClient.invalidateQueries({ queryKey: ['parents', schoolId] })
  }

  const handleDeleteParent = async () => {
    if (!deleteTarget) return
    const { error } = await supabase.from('profiles').delete().eq('id', deleteTarget.id)
    if (error) { toast.error(error.message); setDeleteTarget(null); return }
    toast.success('Parent account deleted')
    setDeleteTarget(null)
    queryClient.invalidateQueries({ queryKey: ['parents', schoolId] })
  }

  const filtered = parents?.filter((p: any) =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="Parents" subtitle="View parent accounts and their linked children" />

      <div className="relative mb-6">
        <Search className="absolute left-3 top-3 w-5 h-5 text-brown-300" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Search by name or email..." />
      </div>

      {filtered && filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((p: any) => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-brown-100 text-brown-600 flex items-center justify-center">
                    <Heart className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-brown-800">{p.first_name} {p.last_name}</p>
                    <p className="text-sm text-brown-400 flex items-center gap-1"><Mail className="w-3 h-3" /> {p.email}</p>
                    {p.phone && <p className="text-sm text-brown-400">{p.phone}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-secondary text-sm" onClick={() => setLinkModalTarget({ parentId: p.id, parentName: `${p.first_name} ${p.last_name}` })}>
                    <Link2 className="w-4 h-4" /> {p.enrollments?.length > 0 ? 'Add Another Child' : 'Link Child'}
                  </button>
                  <button onClick={() => setDeleteTarget({ id: p.id, name: `${p.first_name} ${p.last_name}` })} className="p-2 rounded-lg hover:bg-error-50 text-error-500" aria-label="Delete parent">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {p.enrollments && p.enrollments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {p.enrollments.map((e: any) => (
                    <div key={e.id} className="flex items-center gap-2 bg-cream-100 rounded-lg px-3 py-1.5">
                      <span className="text-sm text-brown-700">
                        {e.student?.first_name} {e.student?.last_name} — {e.class?.name} {e.class?.arm}
                      </span>
                      <button onClick={() => setUnlinkTarget({ enrollmentId: e.id, childName: `${e.student?.first_name} ${e.student?.last_name}` })} className="text-brown-400 hover:text-error-500" aria-label="Unlink child">
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-brown-400">No children linked yet.</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Heart} title="No parents yet" description="Parents appear here once they sign up and link to a student." />
      )}

      <Modal open={!!linkModalTarget} onClose={() => { setLinkModalTarget(null); setLinkIdentifier('') }} title="Link Child">
        <form onSubmit={handleLinkChild} className="space-y-4">
          <p className="text-sm text-brown-500">
            Linking a child to <span className="font-semibold">{linkModalTarget?.parentName}</span>.
          </p>
          <div>
            <label className="label">Student's Admission Number or Email</label>
            <input required value={linkIdentifier} onChange={(e) => setLinkIdentifier(e.target.value)} className="input" placeholder="e.g. DFS-0001 or student@email.com" />
          </div>
          <button type="submit" className="btn btn-primary w-full">Link Child</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!unlinkTarget}
        onClose={() => setUnlinkTarget(null)}
        onConfirm={handleUnlink}
        title="Unlink Child"
        message={`${unlinkTarget?.childName} will no longer be visible on this parent's dashboard. Their student account and records are unaffected.`}
        confirmLabel="Unlink"
        danger
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteParent}
        title="Delete Parent Account"
        message={`This removes ${deleteTarget?.name}'s profile and unlinks their children (children's own records are unaffected). Their login itself may still technically exist — contact support if you need it fully removed too. This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
