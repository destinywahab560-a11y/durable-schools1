import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, EmptyState } from '@/components/ui'
import { formatDateTime, getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'
import { MessageSquare, Send } from 'lucide-react'

export default function ParentMessages() {
  const { profile } = useAuthStore()
  const parentId = profile?.id
  const [selectedContact, setSelectedContact] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [contacts, setContacts] = useState<any[]>([])

  const { data: messages, refetch } = useQuery({
    queryKey: ['parent-messages', parentId, selectedContact],
    queryFn: async () => {
      if (!selectedContact) return []
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${parentId},receiver_id.eq.${selectedContact}),and(sender_id.eq.${selectedContact},receiver_id.eq.${parentId})`)
        .order('created_at', { ascending: true })
      return data ?? []
    },
    enabled: !!selectedContact
  })

  useEffect(() => {
    const loadContacts = async () => {
      if (!parentId) return
      const { data: children } = await supabase
        .from('student_enrollments')
        .select('student_id')
        .eq('parent_id', parentId)
      if (!children || children.length === 0) return

      const studentIds = children.map((c) => c.student_id)
      const { data: enrollments } = await supabase
        .from('student_enrollments')
        .select('class_id')
        .in('student_id', studentIds)
      const classIds = [...new Set(enrollments?.map((e) => e.class_id) ?? [])]
      if (classIds.length === 0) return

      const { data: assignments } = await supabase
        .from('teacher_assignments')
        .select('teacher:profiles(id, first_name, last_name)')
        .in('class_id', classIds)
        .eq('status', 'approved')

      const teacherMap = new Map<string, any>()
      assignments?.forEach((a: any) => {
        if (a.teacher) teacherMap.set(a.teacher.id, a.teacher)
      })
      setContacts([...teacherMap.values()])
    }
    loadContacts()
  }, [parentId])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || !selectedContact) return
    const { error } = await supabase.from('messages').insert({
      sender_id: parentId,
      receiver_id: selectedContact,
      body: message
    })
    if (error) { toast.error(error.message); return }
    setMessage('')
    refetch()
  }

  return (
    <div>
      <PageHeader title="Messages" subtitle="Communicate with your children's teachers" />

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
                  <div className="w-10 h-10 rounded-full bg-brown-600 text-cream-100 flex items-center justify-center text-sm font-semibold">
                    {getInitials(`${c.first_name} ${c.last_name}`)}
                  </div>
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
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender_id === parentId ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-2 rounded-lg ${
                        m.sender_id === parentId ? 'bg-brown-600 text-cream-100' : 'bg-cream-200 text-brown-700'
                      }`}>
                        <p className="text-sm">{m.body}</p>
                        <p className={`text-xs mt-1 ${m.sender_id === parentId ? 'text-cream-300' : 'text-brown-300'}`}>
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
