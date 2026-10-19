import {cp, mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await rm('docs', {recursive:true, force:true});
await mkdir('docs/assets', {recursive:true});
// Every module gets a new URL together, so an older installed worker cannot mix releases.
const clientHash = createHash('sha256');
for (const f of (await readdir('.build')).sort()) {clientHash.update(f);clientHash.update(await readFile(`.build/${f}`));}
clientHash.update(await readFile('src/styles.css'));
const clientVersion = clientHash.digest('hex').slice(0, 12);
await cp('.build', `docs/assets/${clientVersion}`, {recursive:true});
await cp('src/styles.css', `docs/assets/${clientVersion}/styles.css`);
const html = (await readFile('index.html', 'utf8')).replaceAll('./assets/', `./assets/${clientVersion}/`).replace('</head>', `  <meta name="tangent-client" content="${clientVersion}">\n</head>`);
await writeFile('docs/index.html', html);
await cp('public', 'docs', {recursive:true});
await writeFile('docs/.nojekyll', '');
async function files(dir, prefix = '') {const out=[];for (const e of await readdir(dir,{withFileTypes:true})) {const name=prefix+e.name;if(e.isDirectory())out.push(...await files(`${dir}/${e.name}`, `${name}/`));else out.push(name);}return out;}
const assets = (await files('docs')).filter(file => !file.startsWith('.')).sort();
const hash = createHash('sha256');
for (const f of assets) {hash.update(f);hash.update(await readFile(`docs/${f}`));}
const version = hash.digest('hex').slice(0,12);
const sw = `// TANGENT STRIKE — atomic offline shell ${version}
const PREFIX = 'tangent-strike:' + self.registration.scope + ':';
const CACHE = PREFIX + '${version}';
const FILES = ${JSON.stringify(['./', ...assets.map(f=>'./'+f)])};
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
`;
await writeFile('docs/sw.js', sw);
await writeFile('docs/version.json', JSON.stringify({version, files:[...assets, 'sw.js']}, null, 2));
console.log(`Built ${assets.length + 2} files. Offline version: ${version}`);
