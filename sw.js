// ===========================
// SERVICE WORKER - sw.js
// ===========================

const CACHE_NAME = 'mylife-v3.8';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './css/base.css',
  './css/layout.css',
  './css/navigation.css',
  './css/drawer.css',
  './css/components.css',
  './css/home.css',
  './css/jadwal.css',
  './css/tugas.css',
  './css/catatan.css',
  './css/keuangan.css',
  './css/kalender.css',
  './css/ai.css',
  './css/profil.css',
  './css/notifikasi.css',
  './css/utilities.css',
  './js/firebase-config.js',
  './js/firebase-service.js',
  './js/storage.js',
  './js/app.js',
  './js/notifikasi.js',
  './js/jadwal.js',
  './js/tugas.js',
  './js/catatan.js',
  './js/keuangan.js',
  './js/kalender.js',
  './js/ai.js',
  './manifest.json',
];

// Install: cache static assets immediately & skip waiting
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate: delete all old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Deleting old cache:', key);
          return caches.delete(key);
        }
      }))
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network-First for HTML/CSS/JS so fresh styles always load, cache as fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // External APIs - network only
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('fonts')) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Local assets - Network First
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
