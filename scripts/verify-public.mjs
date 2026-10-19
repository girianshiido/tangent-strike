import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base = process.env.QA_URL || 'https://girianshiido.github.io/tangent-strike/';
const local = JSON.parse(await readFile('docs/version.json','utf8'));
const live = await fetch(new URL('version.json',base),{cache:'no-store'});
assert.equal(live.status,200);
assert.equal((await live.json()).version,local.version);
const hash = data => createHash('sha256').update(data).digest('hex');
await Promise.all([...local.files,'version.json'].map(async file => {
  const response = await fetch(new URL(file,base),{cache:'no-store'});
  assert.equal(response.status,200,`${file}: HTTP ${response.status}`);
  assert.equal(hash(Buffer.from(await response.arrayBuffer())),hash(await readFile(`docs/${file}`)),`${file}: public content differs`);
}));
console.log(`Verified ${local.files.length + 1} public files, version ${local.version}: ${base}`);
