import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Modal, Spinner, EmptyState, Avatar } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Users, Plus, MessageCircle, MoreVertical } from 'lucide-react'

export default function PTAForumPage() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ title: '', body: '' })
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const { data: forum } = useQuery({
    queryKey: ['pta-forum', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('forums').select('id').eq('school_id', schoolId).eq('forum_type', 'pta').maybeSingle()
      return data
    },
    enabled: !!schoolId
  })

  const { data: hiddenIds } = useQuery({
    queryKey: ['pta-hidden-posts', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('hidden_forum_posts').select('post_id').eq('user_id', profile?.id)
      return new Set((data ?? []).map((h) => h.post_id))
    },
    enabled: !!profile?.id
  })

  const { data: topics, isLoading } = useQuery({
    queryKey: ['pta-topics', forum?.id, hiddenIds?.size],
    queryFn: async () => {
      const { data: posts, error } = await supabase
        .from('forum_posts')
        .select('id, title, body, created_at, author_id, author:profiles!author_id(first_name, last_name, role, photo_url)')
        .eq('forum_id', forum?.id)
        .is('parent_post_id', null)
        .order('created_at', { ascending: false })
      if (error) { console.error('Fetch PTA topics error:', error); throw error }

      const { data: replies } = await supabase
        .from('forum_posts')
        .select('parent_post_id')
        .eq('forum_id', forum?.id)
        .not('parent_post_id', 'is', null)

      const replyCounts = new Map<string, number>()
      ;(replies ?? []).forEach((r) => {
        if (!r.parent_post_id) return
        replyCounts.set(r.parent_post_id, (replyCounts.get(r.parent_post_id) ?? 0) + 1)
      })

      return (posts ?? [])
        .filter((p) => !hiddenIds?.has(p.id))
        .map((p) => ({ ...p, replyCount: replyCounts.get(p.id) ?? 0 }))
    },
    enabled: !!forum?.id && !!hiddenIds
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forum?.id) { toast.error("No PTA space is set up for your school yet — contact support."); return }
    const { error } = await supabase.from('forum_posts').insert({
      forum_id: forum.id,
      author_id: profile?.id,
      title: form.title,
      body: form.body
    })
    if (error) { toast.error(error.message); return }
    toast.success('Topic posted')
    setModalOpen(false)
    setForm({ title: '', body: '' })
    queryClient.invalidateQueries({ queryKey: ['pta-topics', forum?.id] })
  }

  const hideForMe = async (postId: string) => {
    const { error } = await supabase.from('hidden_forum_posts').insert({ user_id: profile?.id, post_id: postId })
    if (error) { toast.error(error.message); return }
    setOpenMenuId(null)
    queryClient.invalidateQueries({ queryKey: ['pta-hidden-posts', profile?.id] })
  }

  const deleteForEveryone = async (postId: string) => {
    const { error } = await supabase.from('forum_posts').delete().eq('id', postId)
    if (error) { toast.error(error.message); return }
    setOpenMenuId(null)
    toast.success('Topic deleted')
    queryClient.invalidateQueries({ queryKey: ['pta-topics', forum?.id] })
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="PTA Discussion"
        subtitle="A shared space for parents, teachers, and admin to discuss the school"
        action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> New Topic</button>}
      />

      {topics && topics.length > 0 ? (
        <div className="space-y-3">
          {topics.map((t: any) => {
            const canDeleteForEveryone = t.author_id === profile?.id || profile?.role === 'admin'
            return (
              <div key={t.id} className="card flex gap-3 hover:border-brown-300 transition-colors relative">
                <Link to={`/pta/${t.id}`} className="flex gap-3 flex-1">
                  <Avatar photoUrl={t.author?.photo_url} name={`${t.author?.first_name} ${t.author?.last_name}`} />
                  <div className="flex-1">
                    <p className="font-semibold text-brown-800">{t.title}</p>
                    <p className="text-sm text-brown-500 line-clamp-2 mt-1">{t.body}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-brown-400">
                      <span>{t.author?.first_name} {t.author?.last_name} · {t.author?.role}</span>
                      <span>{formatDateTime(t.created_at)}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {t.replyCount}</span>
                    </div>
                  </div>
                </Link>
                <div className="relative">
                  <button
                    onClick={(e) => { e.preventDefault(); setOpenMenuId(openMenuId === t.id ? null : t.id) }}
                    className="p-2 rounded-lg hover:bg-cream-200 text-brown-400"
                    aria-label="Topic options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {openMenuId === t.id && (
                    <div className="absolute right-0 top-8 bg-white border border-cream-300 rounded-lg shadow-lg z-10 text-sm overflow-hidden">
                      <button onClick={(e) => { e.preventDefault(); hideForMe(t.id) }} className="block w-full text-left px-4 py-2 hover:bg-cream-100 text-brown-700 whitespace-nowrap">
                        Delete for me
                      </button>
                      {canDeleteForEveryone && (
                        <button onClick={(e) => { e.preventDefault(); deleteForEveryone(t.id) }} className="block w-full text-left px-4 py-2 hover:bg-cream-100 text-error-600 whitespace-nowrap">
                          Delete for everyone
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState icon={Users} title="No topics yet" description="Start the first discussion — fee changes, school improvements, anything worth raising together."
          action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> New Topic</button>} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New PTA Topic">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" placeholder="e.g. Proposal to review term fees" />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="input min-h-32" />
          </div>
          <button type="submit" className="btn btn-primary w-full">Post Topic</button>
        </form>
      </Modal>
    </div>
  )
}
