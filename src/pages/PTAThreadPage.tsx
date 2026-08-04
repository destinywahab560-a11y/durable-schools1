import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, Avatar } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import { ArrowLeft, MoreVertical } from 'lucide-react'

export default function PTAThreadPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [replyBody, setReplyBody] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const { data: topic, isLoading } = useQuery({
    queryKey: ['pta-topic', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_posts')
        .select('id, title, body, created_at, forum_id, author_id, author:profiles!author_id(first_name, last_name, role, photo_url)')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!id
  })

  const { data: hiddenIds } = useQuery({
    queryKey: ['pta-hidden-posts', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('hidden_forum_posts').select('post_id').eq('user_id', profile?.id)
      return new Set((data ?? []).map((h) => h.post_id))
    },
    enabled: !!profile?.id
  })

  const { data: replies } = useQuery({
    queryKey: ['pta-replies', id, hiddenIds?.size],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_posts')
        .select('id, body, created_at, author_id, author:profiles!author_id(first_name, last_name, role, photo_url)')
        .eq('parent_post_id', id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []).filter((r) => !hiddenIds?.has(r.id))
    },
    enabled: !!id && !!hiddenIds
  })

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic) return
    const { error } = await supabase.from('forum_posts').insert({
      forum_id: topic.forum_id,
      author_id: profile?.id,
      parent_post_id: id,
      title: topic.title,
      body: replyBody
    })
    if (error) { toast.error(error.message); return }
    setReplyBody('')
    queryClient.invalidateQueries({ queryKey: ['pta-replies', id] })
    queryClient.invalidateQueries({ queryKey: ['pta-topics'] })
  }

  const hideReplyForMe = async (replyId: string) => {
    const { error } = await supabase.from('hidden_forum_posts').insert({ user_id: profile?.id, post_id: replyId })
    if (error) { toast.error(error.message); return }
    setOpenMenuId(null)
    queryClient.invalidateQueries({ queryKey: ['pta-hidden-posts', profile?.id] })
  }

  const deleteReplyForEveryone = async (replyId: string) => {
    const { error } = await supabase.from('forum_posts').delete().eq('id', replyId)
    if (error) { toast.error(error.message); return }
    setOpenMenuId(null)
    queryClient.invalidateQueries({ queryKey: ['pta-replies', id] })
  }

  const hideTopicForMe = async () => {
    if (!id) return
    const { error } = await supabase.from('hidden_forum_posts').insert({ user_id: profile?.id, post_id: id })
    if (error) { toast.error(error.message); return }
    navigate('/pta')
  }

  const deleteTopicForEveryone = async () => {
    if (!id) return
    const { error } = await supabase.from('forum_posts').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Topic deleted')
    navigate('/pta')
  }

  if (isLoading) return <Spinner />
  if (!topic) return <div className="p-8 text-center text-brown-500">Topic not found.</div>

  const canDeleteTopicForEveryone = topic.author_id === profile?.id || profile?.role === 'admin'

  return (
    <div>
      <Link to="/pta" className="flex items-center gap-1 text-sm text-brown-500 hover:text-brown-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to PTA Discussion
      </Link>
      <div className="flex items-start gap-3 mb-6">
        <Avatar photoUrl={(topic.author as any)?.photo_url} name={`${(topic.author as any)?.first_name} ${(topic.author as any)?.last_name}`} size="md" />
        <div className="flex-1">
          <PageHeader title={topic.title} subtitle={`${(topic.author as any)?.first_name} ${(topic.author as any)?.last_name} · ${(topic.author as any)?.role} · ${formatDateTime(topic.created_at)}`} />
        </div>
        <div className="relative">
          <button onClick={() => setOpenMenuId(openMenuId === 'topic' ? null : 'topic')} className="p-2 rounded-lg hover:bg-cream-200 text-brown-400" aria-label="Topic options">
            <MoreVertical className="w-4 h-4" />
          </button>
          {openMenuId === 'topic' && (
            <div className="absolute right-0 top-10 bg-white border border-cream-300 rounded-lg shadow-lg z-10 text-sm overflow-hidden">
              <button onClick={hideTopicForMe} className="block w-full text-left px-4 py-2 hover:bg-cream-100 text-brown-700 whitespace-nowrap">
                Delete for me
              </button>
              {canDeleteTopicForEveryone && (
                <button onClick={deleteTopicForEveryone} className="block w-full text-left px-4 py-2 hover:bg-cream-100 text-error-600 whitespace-nowrap">
                  Delete for everyone
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <p className="text-brown-700 whitespace-pre-wrap">{topic.body}</p>
      </div>

      <h3 className="font-semibold text-brown-800 mb-3">{replies?.length ?? 0} {replies?.length === 1 ? 'Reply' : 'Replies'}</h3>
      <div className="space-y-3 mb-6">
        {replies?.map((r) => {
          const canDeleteForEveryone = r.author_id === profile?.id || profile?.role === 'admin'
          return (
            <div key={r.id} className="card flex gap-3">
              <Avatar photoUrl={(r.author as any)?.photo_url} name={`${(r.author as any)?.first_name} ${(r.author as any)?.last_name}`} />
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <p className="text-brown-700 whitespace-pre-wrap flex-1">{r.body}</p>
                  <div className="relative">
                    <button onClick={() => setOpenMenuId(openMenuId === r.id ? null : r.id)} className="p-1 text-brown-300 hover:text-brown-600" aria-label="Reply options">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {openMenuId === r.id && (
                      <div className="absolute right-0 top-6 bg-white border border-cream-300 rounded-lg shadow-lg z-10 text-sm overflow-hidden">
                        <button onClick={() => hideReplyForMe(r.id)} className="block w-full text-left px-4 py-2 hover:bg-cream-100 text-brown-700 whitespace-nowrap">
                          Delete for me
                        </button>
                        {canDeleteForEveryone && (
                          <button onClick={() => deleteReplyForEveryone(r.id)} className="block w-full text-left px-4 py-2 hover:bg-cream-100 text-error-600 whitespace-nowrap">
                            Delete for everyone
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-brown-400 mt-2">
                  {(r.author as any)?.first_name} {(r.author as any)?.last_name} · {(r.author as any)?.role} · {formatDateTime(r.created_at)}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <form onSubmit={handleReply} className="card">
        <label className="label">Reply</label>
        <textarea required value={replyBody} onChange={(e) => setReplyBody(e.target.value)} className="input min-h-24 mb-3" placeholder="Share your thoughts..." />
        <button type="submit" className="btn btn-primary">Post Reply</button>
      </form>
    </div>
  )
}
