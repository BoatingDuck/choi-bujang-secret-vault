import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runAttackChecks } from '../src/attack-check.mjs';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('src/attack-check.mjs', root), 'utf8');

test('stage12 uses separate read-only branch; existing stage branches preserved', () => {
  assert.match(source, /if \(config\.step === 12\) return runStage12ReadOnlyChecks\(config\);/);
  assert.match(source, /if \(config\.step === 9 \|\| config\.step === 10 \|\| config\.step === 11\)/);
  assert.match(source, /runStage4Checks\(config, config\.step\)/);
});

test('sandbox runs only GET on public HTTPS, and labels writes not_run', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (input, options = {}) => {
      const url = new URL(input);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.hostname, 'stage12.test.example.com');
      assert.equal(options.method, 'GET');
      calls.push({ path: url.pathname, headers: options.headers });
      if (url.pathname === '/api/notes') {
        return { status: 401, json: async () => ({ error: '로그인이 필요합니다.' }) };
      }
      if (url.pathname === '/data.json') return { status: 404 };
      if (url.pathname === '/aleph.json') {
        return { status: 200, json: async () => ({ step: 12 }) };
      }
      throw Error('Unexpected request');
    };
    const attempts = await runAttackChecks({step:12,publicAppUrl:'https://stage12.test.example.com/'});
    assert.equal(attempts.length, 9);
    assert.equal(calls.length, 4);
    assert.equal(new Set(attempts.map(x=>x.attackId)).size, 9);
    assert.deepEqual(attempts.filter(x=>x.observed === 'not_run').map(x=>x.attackId),
      ['unauthenticated_api_write','restore_unauthenticated_denied','test_policy_recovery']);
    assert.equal(attempts.find(x=>x.attackId === 'normal_read_preserved').observed,
      '로컬 가상 검사: observe');
    assert.match(attempts.find(x=>x.attackId === 'burst_read_revocation').observed, /실제 회수 아님/);
  } finally { globalThis.fetch = originalFetch; }
});

test('missing public identity is not mislabelled as success', async () => {
  const old = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    assert.equal(options.method, 'GET');
    const path = new URL(input).pathname;
    return path === '/api/notes'
      ? { status:401, json:async()=>({error:'unauthorized'}) }
      : path === '/data.json' ? {status:404} : {status:200,json:async()=>({step:11})};
  };
  try {
    await assert.rejects(runAttackChecks({step:12,publicAppUrl:'https://stage12.test.example.com/'}),
      /배포 식별/);
  } finally { globalThis.fetch = old; }
});

test('checkpoint and bundle output schema stay compatible', async () => {
  const bundle = await readFile(new URL('scripts/bundle.mjs', root), 'utf8');
  assert.match(bundle, /attackId,expected,observed/);
  assert.match(bundle, /runAttackChecks\(config\)/);
  assert.match(source, /attackId: 'restore_unauthenticated_denied'/);
  assert.match(source, /attackId: 'test_policy_recovery'/);
});
