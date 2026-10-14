import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runAttackChecks } from '../src/attack-check.mjs';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('src/attack-check.mjs', root), 'utf8');

test('stage12 uses read-only sandbox branch and preserves previous-stage paths', () => {
  assert.match(source, /if \(config\.step === 12\) return runStage12ReadOnlyChecks\(config\);/);
  assert.match(source, /if \(config\.step === 9 \|\| config\.step === 10 \|\| config\.step === 11\)/);
  assert.match(source, /runStage4Checks\(config, config\.step\)/);
});

test('local HTTPS GET outcomes without judge audit traces are all submitted as not_run', async () => {
  const oldFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (input, options = {}) => {
      const url = new URL(input);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.hostname, 'stage12.test.example.com');
      assert.equal(options.method, 'GET');
      calls.push({ path: url.pathname, headers: options.headers });
      if (url.pathname === '/api/notes') return { status: 401, json: async () => ({error:'로그인이 필요합니다.'}) };
      if (url.pathname === '/data.json') return { status:404 };
      if (url.pathname === '/aleph.json') return { status:200, json:async()=>({step:12}) };
      throw Error('Unexpected request');
    };
    const attempts = await runAttackChecks({ step:12, publicAppUrl:'https://stage12.test.example.com/' });
    assert.equal(attempts.length, 9);
    assert.equal(calls.length, 4);
    assert.deepEqual(calls.map(x => x.path), ['/api/notes','/api/notes','/data.json','/aleph.json']);
    assert.equal(new Set(attempts.map(x => x.attackId)).size, 9);
    assert.ok(attempts.every(x => x.observed === 'not_run'));
    assert.deepEqual(attempts.map(x => x.attackId), [
      'unauthenticated_api_read','unauthenticated_api_write',
      'invalid_jwt','static_note_exposure','deployment_identity',
      'normal_read_preserved','burst_read_revocation',
      'restore_unauthenticated_denied','test_policy_recovery'
    ]);
    assert.ok(attempts.every(x => Object.keys(x).sort().join(',') === 'attackId,expected,observed'));
  } finally { globalThis.fetch = oldFetch; }
});

test('wrong deployment step still fails instead of pretending a verified result', async () => {
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = async input => {
      const path = new URL(input).pathname;
      return path === '/api/notes' ? { status:401, json:async()=>({error:'unauthorized'}) }
        : path === '/data.json' ? { status:404 } : {status:200,json:async()=>({step:11})};
    };
    await assert.rejects(runAttackChecks({step:12,publicAppUrl:'https://stage12.test.example.com/'}), /배포 식별/);
  } finally { globalThis.fetch = oldFetch; }
});

test('sandbox does not import unsupported crypto or issue POST and bundle schema remains stable', async () => {
  const stage12 = source.split('async function runStage12ReadOnlyChecks(config) {')[1]
    .split('export async function runAttackChecks(config)')[0];
  assert.doesNotMatch(stage12, /method:\s*['"]POST['"]|import\(['"][^'"]*policy-recovery|writeFileSync/);
  assert.match(stage12, /method:\s*['"]GET['"]/);
  const bundle = await readFile(new URL('scripts/bundle.mjs', root), 'utf8');
  assert.match(bundle, /attackId,expected,observed/);
  assert.match(bundle, /runAttackChecks\(config\)/);
  assert.match(stage12, /attackId: 'restore_unauthenticated_denied'/);
  assert.match(stage12, /attackId: 'test_policy_recovery'/);
});
