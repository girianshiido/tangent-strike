// TANGENT STRIKE — atomic offline shell 37fa7c0d8960
const PREFIX = 'tangent-strike:' + self.registration.scope + ':';
const CACHE = PREFIX + '37fa7c0d8960';
const FILES = ["./","./assets/f7d9e7006b31/board.js","./assets/f7d9e7006b31/engine.js","./assets/f7d9e7006b31/install.js","./assets/f7d9e7006b31/main.js","./assets/f7d9e7006b31/storage.js","./assets/f7d9e7006b31/styles.css","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon.svg","./icons/maskable-512.png","./index.html","./manifest.webmanifest"];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.href.startsWith(self.registration.scope)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match(new URL('./index.html', self.registration.scope)))));
  } else {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request)) || fetch(event.request)));
  }
});
