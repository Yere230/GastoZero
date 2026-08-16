// ZeroGasto Service Worker
const CACHE_NAME = 'zerogasto-v1';

// Files to cache (main app + CDN libraries)
const ASSETS = [
  './index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
];

// Install — pre-cache main app file
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache index.html always; CDN files are best-effort
      return cache.add('./index.html').then(() => {
        return Promise.allSettled(ASSETS.slice(1).map(url => cache.add(url)));
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for app, network-first for CDN
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always serve index.html from cache if offline
  if(url.pathname.endsWith('/') || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/gastozero.html')){
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Network-first for CDN scripts; fallback to cache
  if(url.hostname.includes('cdnjs') || url.hostname.includes('googleapis') || url.hostname.includes('gstatic')){
    event.respondWith(
      fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Default: network first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
