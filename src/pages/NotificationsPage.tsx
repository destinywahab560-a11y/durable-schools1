import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, EmptyState } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'
import { Bell, Check } from 'lucide-react'

export default function NotificationsPage() {
  const { profile } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) { console.error('Fetch notifications error:', error); throw error }
      return data ?? []
    },
    enabled: !!profile?.id
  })

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['notifications', profile?.id] })
    queryClient.invalidateQueries({ queryKey: ['unread-notifications-count', profile?.id] })
  }

  const markAllRead = async () => {
    if (!profile?.id) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false)
    queryClient.invalidateQueries({ queryKey: ['notifications', profile?.id] })
    queryClient.invalidateQueries({ queryKey: ['unread-notifications-count', profile?.id] })
  }

  if (isLoading) return <Spinner />

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Updates from your school"
        action={unreadCount > 0 ? <button className="btn btn-ghost text-sm" onClick={markAllRead}>Mark all as read</button> : undefined}
      />

      {notifications && notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`card flex items-start gap-3 ${!n.is_read ? 'border-brown-300 bg-cream-100' : ''}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${!n.is_read ? 'bg-brown-200 text-brown-700' : 'bg-cream-200 text-brown-400'}`}>
                <Bell className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-brown-800">{n.title}</p>
                {n.body && <p className="text-sm text-brown-500 mt-0.5">{n.body}</p>}
                <p className="text-xs text-brown-300 mt-1">{formatDateTime(n.created_at)}</p>
              </div>
              {!n.is_read && (
                <button onClick={() => markAsRead(n.id)} className="p-2 rounded-lg hover:bg-cream-200 text-brown-400" aria-label="Mark as read">
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Bell} title="No notifications yet" description="School updates will show up here." />
      )}
    </div>
  )
}
