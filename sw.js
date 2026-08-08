var CACHE_NAME = 'expense-diary-v1';
var LOCAL = ['./','./index.html','./manifest.json','./icon-192.svg','./icon-512.svg'];
var CDN = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js@4',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd-wasm.js',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap',
  'https://fonts.googleapis.com/icon?family=Material+Icons+Round'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(LOCAL).then(function() {
        return Promise.allSettled(
          CDN.map(function(url) {
            return fetch(url).then(function(res) {
              if (res.ok) cache.put(url, res);
            }).catch(function() {});
          })
        );
      });
    }).then(function() { self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(res) {
        if (!res || !res.ok) return res;
        var clone = res.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          try { cache.put(e.request, clone); } catch(ex) {}
        });
        return res;
      }).catch(function() {
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline', {status: 503});
      });
    })
  );
});