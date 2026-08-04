import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, EmptyState, Avatar } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import { MessageSquare, Send, MoreVertical } from 'lucide-react'

export default function TeacherMessages() {
  const { profile } = useAuthStore()
  const [selectedContact, setSelectedContact] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [contacts, setContacts] = useState<any[]>([])
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const { data: messages, refetch } = useQuery({
    queryKey: ['messages', profile?.id, selectedContact],
    queryFn: async () => {
      if (!selectedContact) return []
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${profile?.id},receiver_id.eq.${selectedContact}),and(sender_id.eq.${selectedContact},receiver_id.eq.${profile?.id})`)
        .order('created_at', { ascending: true })
      // Hide anything this person deleted "for me" on their own side
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

      // Proactive list: every student in a class this teacher teaches,
      // plus those students' linked parents — so the teacher can start
      // a conversation, not just reply to one already started.
      const { data: myClassrooms } = await supabase.from('classrooms').select('id, class_id').eq('teacher_id', profile.id)
      const classIds = [...new Set((myClassrooms ?? []).map((c) => c.class_id))]

      const ids = new Set<string>()
      if (classIds.length > 0) {
        const { data: enrollments } = await supabase
          .from('student_enrollments').select('student_id, parent_id').in('class_id', classIds)
        ;(enrollments ?? []).forEach((e) => {
          if (e.student_id) ids.add(e.student_id)
          if (e.parent_id) ids.add(e.parent_id)
        })
      }

      // Also keep anyone already messaged, even if no longer a current student
      const { data: sent } = await supabase.from('messages').select('receiver_id').eq('sender_id', profile.id)
      const { data: received } = await supabase.from('messages').select('sender_id').eq('receiver_id', profile.id)
      sent?.forEach((m) => ids.add(m.receiver_id))
      received?.forEach((m) => ids.add(m.sender_id))

      if (ids.size === 0) { setContacts([]); return }
      const { data: profiles } = await supabase
        .from('profiles').select('id, first_name, last_name, role, photo_url').in('id', [...ids])
      setContacts(profiles ?? [])
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
      <PageHeader title="Messages" subtitle="Communicate with students and parents" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Contact list */}
        <div className="card overflow-y-auto">
          <h3 className="text-sm font-semibold text-brown-600 mb-3">Contacts</h3>
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
                    <p className="text-xs text-brown-400">{c.role}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-brown-400 text-center py-8">No contacts yet</p>
          )}
        </div>

        {/* Chat area */}
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
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="input flex-1"
                  placeholder="Type a message..."
                />
                <button type="submit" className="btn btn-primary">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <EmptyState icon={MessageSquare} title="Select a conversation" description="Choose a contact to start messaging." />
          )}
        </div>
      </div>
    </div>
  )
}
