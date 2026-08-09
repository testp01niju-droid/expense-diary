var V='ev6';
self.addEventListener('install',function(e){
  e.waitUntil(
    caches.open(V).then(function(c){
      return c.addAll(['./','./index.html','./manifest.json']);
    }).then(function(){self.skipWaiting()})
  );
});
self.addEventListener('activate',function(e){
  e.waitUntil(
    caches.keys().then(function(ks){
      return Promise.all(ks.filter(function(k){return k!==V}).map(function(k){return caches.delete(k)}));
    }).then(function(){self.clients.claim()})
  );
});
self.addEventListener('fetch',function(e){
  if(e.request.method!=='GET')return;
  e.respondWith(
    caches.match(e.request).then(function(r){
      if(r)return r;
      return fetch(e.request).then(function(res){
        if(!res||res.status!==200)return res;
        var clone=res.clone();
        caches.open(V).then(function(c){c.put(e.request,clone)});
        return res;
      }).catch(function(){
        if(e.request.mode==='navigate')return caches.match('./index.html');
        return new Response('Offline',{status:503});
      });
    })
  );
});
