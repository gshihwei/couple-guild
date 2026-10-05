const CACHE='couple-guild-v0.2.5-landscape-shell';
const ASSETS=['/','/index.html','/src/main.js','/src/game.js','/src/state.js','/src/ui.js','/src/cats.js','/manifest.webmanifest','/icons/icon.svg','/assets/fly.png','/assets/hu.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return resp;}).catch(()=>caches.match('/')));});
