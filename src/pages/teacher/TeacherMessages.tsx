import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, EmptyState } from '@/components/ui'
import { formatDateTime, getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'
import { MessageSquare, Send } from 'lucide-react'

export default function TeacherMessages() {
  const { profile } = useAuthStore()
  const [selectedContact, setSelectedContact] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [contacts, setContacts] = useState<any[]>([])

  const { data: messages, refetch } = useQuery({
    queryKey: ['messages', profile?.id, selectedContact],
    queryFn: async () => {
      if (!selectedContact) return []
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${profile?.id},receiver_id.eq.${selectedContact}),and(sender_id.eq.${selectedContact},receiver_id.eq.${profile?.id})`)
        .order('created_at', { ascending: true })
      return data ?? []
    },
    enabled: !!selectedContact
  })

  useEffect(() => {
    const loadContacts = async () => {
      if (!profile?.id || !profile?.school_id) return
      const { data: sent } = await supabase
        .from('messages').select('receiver_id').eq('sender_id', profile.id)
      const { data: received } = await supabase
        .from('messages').select('sender_id').eq('receiver_id', profile.id)
      const ids = new Set<string>()
      sent?.forEach((m) => ids.add(m.receiver_id))
      received?.forEach((m) => ids.add(m.sender_id))
      if (ids.size === 0) { setContacts([]); return }
      const { data: profiles } = await supabase
        .from('profiles').select('id, first_name, last_name, role').in('id', [...ids])
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

  return (
    <div>
      <PageHeader title="Messages" subtitle="Communicate with students and parents" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Contact list */}
        <div className="card overflow-y-auto">
          <h3 className="text-sm font-semibold text-brown-600 mb-3">Conversations</h3>
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
                  <div className="w-10 h-10 rounded-full bg-brown-600 text-cream-100 flex items-center justify-center text-sm font-semibold">
                    {getInitials(`${c.first_name} ${c.last_name}`)}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-brown-700">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-brown-400">{c.role}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-brown-400 text-center py-8">No conversations yet</p>
          )}
        </div>

        {/* Chat area */}
        <div className="lg:col-span-2 card flex flex-col">
          {selectedContact ? (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                {messages && messages.length > 0 ? (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender_id === profile?.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-2 rounded-lg ${
                        m.sender_id === profile?.id ? 'bg-brown-600 text-cream-100' : 'bg-cream-200 text-brown-700'
                      }`}>
                        <p className="text-sm">{m.body}</p>
                        <p className={`text-xs mt-1 ${m.sender_id === profile?.id ? 'text-cream-300' : 'text-brown-300'}`}>
                          {formatDateTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
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
