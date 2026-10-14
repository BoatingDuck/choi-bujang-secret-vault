import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('step 12 checkpoint retains original services and issuer', async () => {
  const c = JSON.parse(await read('aleph.config.json'));
  assert.equal(c.step, 12);
  assert.match(c.publicAppUrl, /^https:\/\//);
  assert.match(c.judgeIssuer, /^https:\/\//);
  assert.match(c.identityProvider.issuer, /^https:\/\//);
  assert.ok(c.allowedRoutes.includes('GET /api/notes'));
  assert.equal(c.restoreRoute, '/api/restore-note');
});

test('bundle self-check includes 12 and earlier local checks', async () => {
  const source = await read('src/attack-check.mjs');
  assert.match(source, /config\.step === 12/);
  assert.match(source, /runStage4Checks\(config, config\.step\)/);
  assert.match(source, /'restore_unauthenticated_denied'/);
  assert.match(source, /'test_policy_recovery'/);
});

test('README explains provenance, verified checks, restart and recovery without 41 PASS claims', async () => {
  const doc = await read('docs/STAGE12.md');
  const readme = await read('README.md');
  for (const word of ['ALEPH SDP', 'NOT_RUN', '설치', '실행', '중지', '복구', '41종']) {
    assert.ok(doc.includes(word), word);
  }
  assert.match(readme, /12단계/);
  assert.match(readme, /docs\/STAGE12\.md/);
});

test('stage 12 docs cannot imply exercise PASS equals engine enforcement', async () => {
  const doc = await read('docs/STAGE12.md');
  assert.match(doc, /로컬 가상 검사/);
  assert.match(doc, /실제.*회수/);
  assert.match(doc, /NOT_RUN/);
  assert.doesNotMatch(doc, /41종 (?:모두 )?(?:PASS|통과|차단 완료)/);
});
