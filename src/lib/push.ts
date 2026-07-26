import { supabase } from '@/lib/supabase'

// Safe to expose publicly — this is the VAPID *public* key, which is
// meant to be visible in the browser. The private key never leaves
// the Supabase Edge Function secrets.
export const VAPID_PUBLIC_KEY = 'BGBwd5Wa6HB1_Va83D2qYbbwyhTgZoWlpHxwK6bc_nVsLzjoJnzur8hXNfwA0rtKLvaShdI-gkFVWhak4-jIMNw'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export async function enablePushNotifications(userId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error("This browser/device doesn't support push notifications.")
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.')
  }

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })
  }

  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint!,
      p256dh: json.keys!.p256dh,
      auth: json.keys!.auth
    },
    { onConflict: 'user_id,endpoint' }
  )
  if (error) throw error

  return subscription
}
