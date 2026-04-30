// EasyTaxi Israel — Premium Service Worker v3
// Strategy: Cache-first for static assets, Network-first for API calls
const CACHE_NAME = 'easytaxi-v3'
const STATIC_CACHE = 'easytaxi-static-v3'
const API_CACHE    = 'easytaxi-api-v1'

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/site.webmanifest',
]

// ── Install: pre-cache shell ────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate: clean up old caches ──────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names
          .filter(n => n !== STATIC_CACHE && n !== API_CACHE)
          .map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Fetch: routing strategy ────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin (except fonts)
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin && !url.hostname.includes('fonts.g')) return

  // API calls → Network-first, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(API_CACHE).then(c => c.put(request, clone))
          }
          return res
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Navigation requests → Network-first, fall back to index.html (SPA)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // Static assets → Cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(res => {
        if (res.ok && res.type !== 'opaque') {
          const clone = res.clone()
          caches.open(STATIC_CACHE).then(c => c.put(request, clone))
        }
        return res
      })
    })
  )
})
