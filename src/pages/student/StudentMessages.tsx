import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, EmptyState, Avatar } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import { MessageSquare, Send, MoreVertical } from 'lucide-react'

export default function StudentMessages() {
  const { profile } = useAuthStore()
  const [selectedContact, setSelectedContact] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [contacts, setContacts] = useState<any[]>([])
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const { data: messages, refetch } = useQuery({
    queryKey: ['student-messages', profile?.id, selectedContact],
    queryFn: async () => {
      if (!selectedContact) return []
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${profile?.id},receiver_id.eq.${selectedContact}),and(sender_id.eq.${selectedContact},receiver_id.eq.${profile?.id})`)
        .order('created_at', { ascending: true })
      return (data ?? []).filter((m) => {
        if (m.sender_id === profile?.id && m.deleted_by_sender) return false
        if (m.receiver_id === profile?.id && m.deleted_by_receiver) return false
        return true
      })
    },
    enabled: !!selectedContact
  })

  useEffect(() => {
    const loadContacts = async () => {
      if (!profile?.id || !profile?.school_id) return
      const { data: teachers } = await supabase
        .from('teacher_assignments')
        .select('teacher:profiles(id, first_name, last_name, photo_url)')
        .eq('status', 'approved')
      const teacherMap = new Map<string, any>()
      teachers?.forEach((t: any) => {
        if (t.teacher) teacherMap.set(t.teacher.id, t.teacher)
      })
      setContacts([...teacherMap.values()])
    }
    loadContacts()
  }, [profile?.id, profile?.school_id])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || !selectedContact) return
    const { error } = await supabase.from('messages').insert({
      sender_id: profile?.id,
      receiver_id: selectedContact,
      body: message
    })
    if (error) { toast.error(error.message); return }
    setMessage('')
    refetch()
  }

  const deleteForMe = async (messageId: string, iAmSender: boolean) => {
    const { error } = await supabase.from('messages')
      .update(iAmSender ? { deleted_by_sender: true } : { deleted_by_receiver: true })
      .eq('id', messageId)
    if (error) { toast.error(error.message); return }
    setOpenMenuId(null)
    refetch()
  }

  const deleteForEveryone = async (messageId: string) => {
    const { error } = await supabase.from('messages').delete().eq('id', messageId)
    if (error) { toast.error(error.message); return }
    setOpenMenuId(null)
    refetch()
  }

  return (
    <div>
      <PageHeader title="Messages" subtitle="Ask your teachers questions" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        <div className="card overflow-y-auto">
          <h3 className="text-sm font-semibold text-brown-600 mb-3">Teachers</h3>
          {contacts.length > 0 ? (
            <div className="space-y-2">
              {contacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedContact(c.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    selectedContact === c.id ? 'bg-brown-100' : 'hover:bg-cream-200'
                  }`}
                >
                  <Avatar photoUrl={c.photo_url} name={`${c.first_name} ${c.last_name}`} size="md" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-brown-700">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-brown-400">Teacher</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-brown-400 text-center py-8">No teachers available</p>
          )}
        </div>

        <div className="lg:col-span-2 card flex flex-col">
          {selectedContact ? (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                {messages && messages.length > 0 ? (
                  messages.map((m) => {
                    const iAmSender = m.sender_id === profile?.id
                    return (
                      <div key={m.id} className={`flex ${iAmSender ? 'justify-end' : 'justify-start'}`}>
                        <div className="relative group max-w-[70%]">
                          <div className={`px-4 py-2 rounded-lg ${iAmSender ? 'bg-brown-600 text-cream-100' : 'bg-cream-200 text-brown-700'}`}>
                            <p className="text-sm">{m.body}</p>
                            <p className={`text-xs mt-1 ${iAmSender ? 'text-cream-300' : 'text-brown-300'}`}>
                              {formatDateTime(m.created_at)}
                            </p>
                          </div>
                          <button
                            onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)}
                            className={`absolute top-1 ${iAmSender ? '-left-7' : '-right-7'} p-1 rounded text-brown-300 hover:text-brown-600 opacity-0 group-hover:opacity-100`}
                            aria-label="Message options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openMenuId === m.id && (
                            <div className={`absolute top-6 ${iAmSender ? 'right-0' : 'left-0'} bg-white border border-cream-300 rounded-lg shadow-lg z-10 text-sm overflow-hidden`}>
                              <button onClick={() => deleteForMe(m.id, iAmSender)} className="block w-full text-left px-4 py-2 hover:bg-cream-100 text-brown-700 whitespace-nowrap">
                                Delete for me
                              </button>
                              {iAmSender && (
                                <button onClick={() => deleteForEveryone(m.id)} className="block w-full text-left px-4 py-2 hover:bg-cream-100 text-error-600 whitespace-nowrap">
                                  Delete for everyone
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-brown-400 text-center py-8">No messages yet. Start the conversation!</p>
                )}
              </div>
              <form onSubmit={handleSend} className="flex gap-2">
                <input value={message} onChange={(e) => setMessage(e.target.value)} className="input flex-1" placeholder="Type a message..." />
                <button type="submit" className="btn btn-primary"><Send className="w-4 h-4" /></button>
              </form>
            </>
          ) : (
            <EmptyState icon={MessageSquare} title="Select a teacher" description="Choose a teacher to start messaging." />
          )}
        </div>
      </div>
    </div>
  )
}
