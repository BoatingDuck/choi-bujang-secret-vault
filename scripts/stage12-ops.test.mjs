import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { detect } from '../src/detect.mjs';
import { RULE_IDS } from '../src/decider.mjs';
import { summarizeVirtualDetection, safeOpsView } from '../src/ops-summary.mjs';

const base = {
  requestId: '12345678-1234-4234-8234-123456789abc',
  checkedAt: '2026-10-14T01:00:00.000Z',
  ruleIds: RULE_IDS,
  detection: summarizeVirtualDetection(detect),
  recovery: { status: 'UNAVAILABLE', backupVersion: null, revision: null, changedFields: null },
  notes: { status: 'UNAVAILABLE', ownedCount: null },
  deploymentCommit: null
};

test('virtual detector labels fixture PASS, never claims actual engine revocation', () => {
  const result = summarizeVirtualDetection(detect);
  assert.equal(result.status, 'PASS');
  assert.equal(result.kind, 'VIRTUAL_FIXTURE');
  assert.equal(result.normalAction, 'observe');
  assert.equal(result.burstAction, 'propose_revocation');
  assert.equal(result.realEngineEvents, 'NOT_RUN');
});

test('ops output contains real rule count and marks 41 unrun, never note contents', () => {
  const summary = safeOpsView(base);
  assert.equal(summary.decision.ruleCount, RULE_IDS.length);
  assert.deepEqual(summary.decision.ruleIds, RULE_IDS);
  assert.equal(summary.totalAssaultTests.total, 41);
  assert.equal(summary.totalAssaultTests.status, 'NOT_RUN');
  assert.equal(summary.totalAssaultTests.verified, null);
  assert.equal(summary.revocation.actualEngineRevocation, 'NOT_RUN');
  assert.doesNotMatch(JSON.stringify(summary), /privateKey|access_token|content|\"body\"|password/i);
});

test('unavailable measurements cannot be represented as zero or PASS', () => {
  const summary = safeOpsView(base);
  assert.equal(summary.recovery.revision, null);
  assert.equal(summary.notes.ownedCount, null);
  assert.equal(summary.notes.status, 'UNAVAILABLE');
});

test('status API verifies signed device before reading DB', async () => {
  const api = await readFile(new URL('../api/ops/status.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(api, /verifyRequestUser\(req\)/);
  assert.match(api, /requireApprovedDevice\(req, user\)/);
  assert.match(api, /Cache-Control', 'no-store'/);
  assert.match(html, /\/api\/ops\/status/);
  assert.ok(html.includes('restore-test-policy$|ops\\/status$)'));
  assert.match(html, /id="ops-section"/);
  assert.match(html, /textContent = JSON\.stringify\(data, null, 2\)/);
});
