import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ai from '../api/ai.js';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

async function countFunctions(dir) {
  let count = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) count += await countFunctions(path);
    else if (entry.isFile() && /\.(?:js|mjs|ts)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) count++;
  }
  return count;
}

function runPlaceholder(query) {
  const result = { headers: {}, statusCode: null, body: null };
  const response = {
    setHeader(name, value) { result.headers[name] = value; },
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; }
  };
  ai({ query }, response);
  return result;
}

test('Hobby free limit: exactly 12 api function entrypoints', async () => {
  assert.equal(await countFunctions(fileURLToPath(new URL('api/', root))), 12);
  assert.equal(existsSync(new URL('api/threat-intel.js', root)), false);
});

test('rewrites only the old threat-intel URL and preserves other Vercel settings', async () => {
  const config = JSON.parse(await read('vercel.json'));
  assert.equal(config.framework, null);
  assert.equal(config.outputDirectory, 'public');
  assert.equal(config.buildCommand, 'npm run build');
  assert.deepEqual(config.rewrites, [{
    source: '/api/threat-intel', destination: '/api/ai?stub=threat-intel'
  }]);
});

test('placeholder API keeps both original HTTP 501 response contracts', () => {
  const aiResponse = runPlaceholder({});
  const threatResponse = runPlaceholder({ stub: 'threat-intel' });
  assert.equal(aiResponse.statusCode, 501);
  assert.deepEqual(aiResponse.body, { error: 'AI_PROXY_NOT_IMPLEMENTED' });
  assert.equal(threatResponse.statusCode, 501);
  assert.deepEqual(threatResponse.body, { error: 'THREAT_INTEL_NOT_IMPLEMENTED' });
  assert.equal(aiResponse.headers['Cache-Control'], 'no-store');
  assert.equal(threatResponse.headers['Cache-Control'], 'no-store');
});

test('AI placeholder cannot become a working write endpoint accidentally', () => {
  const response = runPlaceholder({ stub: ['threat-intel', 'ai'], confirm: 'true' });
  assert.equal(response.statusCode, 501);
  assert.deepEqual(response.body, { error: 'AI_PROXY_NOT_IMPLEMENTED' });
});
