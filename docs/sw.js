// TANGENT STRIKE — atomic offline shell 95eab0cf0c7a
const PREFIX = 'tangent-strike:' + self.registration.scope + ':';
const CACHE = PREFIX + '95eab0cf0c7a';
const FILES = ["./","./assets/0d9f4b0a90b3/board.js","./assets/0d9f4b0a90b3/engine.js","./assets/0d9f4b0a90b3/install.js","./assets/0d9f4b0a90b3/main.js","./assets/0d9f4b0a90b3/storage.js","./assets/0d9f4b0a90b3/styles.css","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon.svg","./icons/maskable-512.png","./index.html","./manifest.webmanifest"];
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
