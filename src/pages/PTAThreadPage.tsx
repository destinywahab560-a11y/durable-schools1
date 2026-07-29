import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import { ArrowLeft, Trash2 } from 'lucide-react'

export default function PTAThreadPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuthStore()
  const queryClient = useQueryClient()
  const [replyBody, setReplyBody] = useState('')

  const { data: topic, isLoading } = useQuery({
    queryKey: ['pta-topic', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_posts')
        .select('id, title, body, created_at, forum_id, author:profiles!author_id(first_name, last_name, role)')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!id
  })

  const { data: replies } = useQuery({
    queryKey: ['pta-replies', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_posts')
        .select('id, body, created_at, author_id, author:profiles!author_id(first_name, last_name, role)')
        .eq('parent_post_id', id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!id
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

  const handleDeleteReply = async (replyId: string) => {
    const { error } = await supabase.from('forum_posts').delete().eq('id', replyId)
    if (error) { toast.error(error.message); return }
    queryClient.invalidateQueries({ queryKey: ['pta-replies', id] })
  }

  if (isLoading) return <Spinner />
  if (!topic) return <div className="p-8 text-center text-brown-500">Topic not found.</div>

  return (
    <div>
      <Link to="/pta" className="flex items-center gap-1 text-sm text-brown-500 hover:text-brown-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to PTA Discussion
      </Link>
      <PageHeader title={topic.title} subtitle={`${(topic.author as any)?.first_name} ${(topic.author as any)?.last_name} · ${(topic.author as any)?.role} · ${formatDateTime(topic.created_at)}`} />

      <div className="card mb-6">
        <p className="text-brown-700 whitespace-pre-wrap">{topic.body}</p>
      </div>

      <h3 className="font-semibold text-brown-800 mb-3">{replies?.length ?? 0} {replies?.length === 1 ? 'Reply' : 'Replies'}</h3>
      <div className="space-y-3 mb-6">
        {replies?.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-start justify-between">
              <p className="text-brown-700 whitespace-pre-wrap flex-1">{r.body}</p>
              {(r.author_id === profile?.id || profile?.role === 'admin') && (
                <button onClick={() => handleDeleteReply(r.id)} className="p-1 text-error-400 hover:text-error-600" aria-label="Delete reply">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-xs text-brown-400 mt-2">
              {(r.author as any)?.first_name} {(r.author as any)?.last_name} · {(r.author as any)?.role} · {formatDateTime(r.created_at)}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={handleReply} className="card">
        <label className="label">Reply</label>
        <textarea required value={replyBody} onChange={(e) => setReplyBody(e.target.value)} className="input min-h-24 mb-3" placeholder="Share your thoughts..." />
        <button type="submit" className="btn btn-primary">Post Reply</button>
      </form>
    </div>
  )
}
