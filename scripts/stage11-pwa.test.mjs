import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const get = file => readFile(new URL(file, root), 'utf8');

test('PWA manifest identifies app, icons, and standalone mode', async () => {
  const manifest = JSON.parse(await get('public/manifest.webmanifest'));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.name.includes('BYTE BACK'));
  assert.deepEqual(manifest.icons.map(x => x.sizes), ['192x192', '512x512']);
  for (const entry of manifest.icons) {
    const png = await readFile(new URL('public/' + entry.src.slice(1), root));
    assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
    const expected = parseInt(entry.sizes.split('x')[0], 10);
    assert.equal(png.readUInt32BE(16), expected);
    assert.equal(png.readUInt32BE(20), expected);
  }
});

test('existing login and notes remain; installation cannot imply approval', async () => {
  const html = await get('public/index.html');
  assert.match(html, /rel="manifest" href="\/manifest.webmanifest"/);
  assert.match(html, /id="device-approval-status">서버 미확인/);
  assert.match(html, /id="login-form"/);
  assert.match(html, /id="note-form"/);
  assert.match(html, /apiRequest\('\/api\/notes'\)/);
  assert.match(html, /serviceWorker\.register\('\/sw\.js'/);
  assert.doesNotMatch(html, /(?:localStorage|sessionStorage|indexedDB)\./);
});

test('service worker only caches offline help and never caches protected resources', async () => {
  const sw = await get('public/sw.js');
  assert.match(sw, /cache\.add\(OFFLINE_URL\)/);
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(sw, /request\.mode !== 'navigate'/);
  assert.doesNotMatch(sw, /cache\.put\(/);
  assert.doesNotMatch(sw, /localStorage|sessionStorage|indexedDB/);
  const offline = await get('public/offline.html');
  assert.match(offline, /오프라인 상태입니다/);
});
