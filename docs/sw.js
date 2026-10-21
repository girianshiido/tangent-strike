// TANGENT STRIKE — atomic offline shell 867e7004fa1d
const PREFIX = 'tangent-strike:' + self.registration.scope + ':';
const CACHE = PREFIX + '867e7004fa1d';
const FILES = ["./","./assets/00522ada2b3c/board.js","./assets/00522ada2b3c/engine.js","./assets/00522ada2b3c/icons.js","./assets/00522ada2b3c/install.js","./assets/00522ada2b3c/main.js","./assets/00522ada2b3c/sound-assets.js","./assets/00522ada2b3c/sound.js","./assets/00522ada2b3c/storage.js","./assets/00522ada2b3c/styles.css","./audio/README.txt","./audio/boss-52e83b00e9.mp3","./audio/boss-52e83b00e9.ogg","./audio/collision-9df56550db.mp3","./audio/collision-9df56550db.ogg","./audio/hit-040ea06860.mp3","./audio/hit-040ea06860.ogg","./audio/miss-3465371679.mp3","./audio/miss-3465371679.ogg","./audio/perfect-6e941b14f2.mp3","./audio/perfect-6e941b14f2.ogg","./audio/shot-2817504702.mp3","./audio/shot-2817504702.ogg","./audio/tap-b612a70bbc.mp3","./audio/tap-b612a70bbc.ogg","./audio/win-8c13753cd8.mp3","./audio/win-8c13753cd8.ogg","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon.svg","./icons/maskable-512.png","./index.html","./manifest.webmanifest"];
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
