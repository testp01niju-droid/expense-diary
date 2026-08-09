var APP_CACHE = 'ev7';
var OCR_CACHE = 'ocr-v1';

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(APP_CACHE).then(function(c) {
      return c.addAll(['./', './index.html', './manifest.json', './ocr.js']);
    }).then(function() { self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(ks) {
      return Promise.all(
        ks.filter(function(k) { return k !== APP_CACHE && k !== OCR_CACHE; })
          .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  
  if (e.request.url.includes('ocr.space') || e.request.url.includes('tessdata')) {
    e.respondWith(
      caches.open(OCR_CACHE).then(function(c) {
        return c.match(e.request).then(function(r) {
          return r || fetch(e.request).then(function(res) {
            if (res && res.ok) c.put(e.request, res.clone());
            return res;
          });
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function(r) {
      if (r) return r;
      return fetch(e.request).then(function(res) {
        if (!res || !res.ok) return res;
        caches.open(APP_CACHE).then(function(c) {
          try { c.put(e.request, res.clone()); } catch(x) {}
        });
        return res;
      }).catch(function() {
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline', {status: 503});
      });
    })
  );
});
