// @ts-nocheck
// This file runs only in a service worker context (ServiceWorkerGlobalScope),
// which conflicts with the main app's DOM-lib tsconfig for globals like
// `self`. Vite bundles this file separately and correctly regardless —
// this directive only silences an expected, harmless tsc mismatch.
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

// Same Supabase API caching behavior as before, just written explicitly
// now that we control the service worker source ourselves.
registerRoute(
  ({ url }) => /^https:\/\/.*\.supabase\.co\/.*/i.test(url.href),
  new NetworkFirst({
    cacheName: 'supabase-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 86400 })]
  })
)

// Real push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload: { title?: string; body?: string; url?: string } = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Durable Schools', body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Durable Schools', {
      body: payload.body || '',
      icon: '/images/image.png',
      badge: '/images/image.png',
      data: { url: payload.url || '/notifications' }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/notifications'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
