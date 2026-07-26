import { supabase } from '@/lib/supabase'

export type NotifyRecipients = { userIds: string[] }

/*
 * Stage 1: writes an in-app notification (shows in the bell/inbox) for
 * each recipient. Stage 2 will extend this same function to also
 * dispatch real Email/Push to whichever channels each recipient has
 * enabled — the call sites using this function won't need to change.
 */
export async function sendNotification(
  recipients: NotifyRecipients,
  { title, body, relatedType, relatedId }: { title: string; body?: string; relatedType?: string; relatedId?: string }
) {
  if (recipients.userIds.length === 0) return { count: 0 }

  const rows = recipients.userIds.map((userId) => ({
    user_id: userId,
    title,
    body: body ?? null,
    channel: 'in_app',
    related_type: relatedType ?? null,
    related_id: relatedId ?? null
  }))

  const { error } = await supabase.from('notifications').insert(rows)
  if (error) {
    console.error('sendNotification error:', error)
    throw error
  }

  // Best-effort — if email/push haven't been configured yet, or a
  // provider hiccup occurs, the in-app notification above still landed,
  // so we don't want that to read as a failure to the caller.
  try {
    await supabase.functions.invoke('send-notification', {
      body: { recipientIds: recipients.userIds, title, body }
    })
  } catch (err) {
    console.error('send-notification function error (in-app notification still sent):', err)
  }

  return { count: rows.length }
}
