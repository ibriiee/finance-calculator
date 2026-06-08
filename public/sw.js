// Mizan Service Worker — network-first, no stale caching
const CACHE_NAME = 'mizan-v' + Date.now()

self.addEventListener('install', event => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  // Delete ALL old caches on every activation
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  // Always go to network first — never serve stale HTML/JS
  if (event.request.method !== 'GET') return

  event.respondWith(
    fetch(event.request).catch(() => {
      // Only fall back to cache if truly offline
      return caches.match(event.request)
    })
  )
})
