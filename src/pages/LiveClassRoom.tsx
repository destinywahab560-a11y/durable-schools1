import { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Spinner } from '@/components/ui'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

export default function LiveClassRoom() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profile } = useAuthStore()
  const isTeacher = profile?.role === 'teacher'
  const startedRef = useRef(false)

  const { data: liveClass, isLoading } = useQuery({
    queryKey: ['live-class-room', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_classes')
        .select('id, title, status, classroom:classrooms(name, subject:subjects(name), class:classes(name, arm))')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!id
  })

  // Teacher joining marks the class as actually started, so students see
  // it go from "scheduled" to "live" and know it's really happening.
  useEffect(() => {
    if (isTeacher && liveClass && liveClass.status === 'scheduled' && !startedRef.current) {
      startedRef.current = true
      supabase.from('live_classes').update({ status: 'live' }).eq('id', id)
      queryClient.invalidateQueries({ queryKey: ['live-classes'] })
    }
  }, [isTeacher, liveClass, id, queryClient])

  const handleLeave = async () => {
    if (isTeacher) {
      const { error } = await supabase.from('live_classes').update({ status: 'ended' }).eq('id', id)
      if (error) toast.error(error.message)
      queryClient.invalidateQueries({ queryKey: ['live-classes'] })
    }
    navigate(-1)
  }

  if (isLoading) return <Spinner />

  if (!liveClass) {
    return (
      <div className="p-8 text-center text-brown-500">
        This live class couldn't be found.
        <button className="btn btn-secondary mt-4" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    )
  }

  if (liveClass.status === 'ended' || liveClass.status === 'cancelled') {
    return (
      <div className="p-8 text-center text-brown-500">
        This class has {liveClass.status === 'ended' ? 'already ended' : 'been cancelled'}.
        <button className="btn btn-secondary mt-4 block mx-auto" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    )
  }

  // A namespaced, unguessable room name — the live_class's own id is a
  // UUID, so nobody could stumble onto this room without the exact link.
  const roomName = `durable-schools-${id}`
  const displayName = encodeURIComponent(`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`)
  const jitsiUrl = `https://meet.jit.si/${roomName}#userInfo.displayName="${displayName}"&config.prejoinPageEnabled=false`

  return (
    <div className="fixed inset-0 bg-brown-900 z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-brown-800 text-cream-100">
        <div>
          <p className="font-semibold">{liveClass.title}</p>
          <p className="text-xs text-cream-300">
            {(liveClass.classroom as any)?.subject?.name} — {(liveClass.classroom as any)?.class?.name} {(liveClass.classroom as any)?.class?.arm}
          </p>
        </div>
        <button onClick={handleLeave} className="btn btn-secondary text-sm">
          <X className="w-4 h-4" /> {isTeacher ? 'End Class' : 'Leave'}
        </button>
      </div>
      <iframe
        src={jitsiUrl}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="flex-1 w-full border-0"
        title="Live Class"
      />
    </div>
  )
}
