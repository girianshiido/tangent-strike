import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
const root = resolve('docs'), port = Number(process.env.PORT || 5191);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
createServer(async (req,res) => {
  try {
    const url = new URL(req.url, 'http://localhost');let file = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (file !== root && !file.startsWith(root + '/')) {res.writeHead(403).end();return;}
    if ((await stat(file)).isDirectory()) file = resolve(file,'index.html');
    res.writeHead(200, {'Content-Type':types[extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'});res.end(await readFile(file));
  } catch {res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',() => console.log(`TANGENT STRIKE: http://127.0.0.1:${port}/`));
