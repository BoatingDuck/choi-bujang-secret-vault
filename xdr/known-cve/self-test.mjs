// No external packages, no network, no policy changes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decide } from './decide.mjs';
import { readAlerts } from './read-alerts.mjs';
import { respond } from './respond.mjs';

const fixture = JSON.parse(await readFile(new URL('../fixtures/known-cve.json', import.meta.url), 'utf8'));
assert.equal(fixture?.schema, 'aleph.xdr.fixture.v1');
assert.equal(fixture?.moduleKey, 'known-cve');
assert.equal(fixture.alerts.length, 24, '제공된 24개 경보가 변경된 경우 다시 검토하세요');
assert.equal(readAlerts(fixture.alerts).length, fixture.alerts.length);

const expected = { block: 8, alert: 8, record: 8 };
const counts = { block: 0, alert: 0, record: 0 };
for (const alert of fixture.alerts) {
  const verdict = decide(alert);
  assert.ok(['block', 'alert', 'record'].includes(verdict.action));
  assert.ok(Number.isFinite(verdict.confidence) && verdict.confidence >= 0 && verdict.confidence <= 1);
  assert.ok(typeof verdict.reason === 'string' && verdict.reason.length > 0);
  assert.equal(verdict.action,
    Number(alert.id.split('-')[1]) <= 8 ? 'block' : Number(alert.id.split('-')[1]) <= 16 ? 'alert' : 'record',
    `경보 분류 실패: ${alert.id}`);
  assert.equal(verdict.action,
    verdict.confidence >= 0.85 ? 'block' : verdict.confidence >= 0.5 ? 'alert' : 'record',
    `확신도 기준 불일치: ${alert.id}`);
  counts[verdict.action] += 1;
}
assert.deepEqual(counts, expected);

const source = await readFile(new URL('./decide.mjs', import.meta.url), 'utf8');
assert.ok(!/^\s*import\s/m.test(source), 'decide.mjs에 import가 있습니다');
assert.ok(!/\b(?:readFile|writeFile|appendFile|fetch)\s*\(/.test(source), 'decide.mjs에 I/O가 있습니다');
const patterns = JSON.parse(await readFile(new URL('./patterns.json', import.meta.url), 'utf8'));
for (const pattern of patterns) {
  assert.ok(typeof pattern.name === 'string' && pattern.name.length);
  assert.ok(typeof pattern.condition === 'string' && pattern.condition.length);
  assert.ok(typeof pattern.evidence === 'string' && !pattern.evidence.includes('\n') && pattern.evidence.length);
  assert.ok(source.includes(`name: '${pattern.name}'`), `decide.mjs 패턴 복사 누락: ${pattern.name}`);
}

const time = new Date('2026-10-15T00:00:00.000Z');
const result = await respond({ alerts: fixture.alerts, now: time, ttlMinutes: 15, persist: false });
assert.equal(result.proposedBlocks, 8);
assert.equal(result.alertsLogged, 16);
assert.ok(result.rules.every(r => r.action === 'deny' && r.evidenceAlertId && r.expiresAt === '2026-10-15T00:15:00.000Z'));
assert.ok(result.rules.every(r => Number(r.evidenceAlertId.split('-')[1]) <= 8));

// Shared-source safety: never propose blanket source-IP denial when normal
// activity from the same IP is observed in the same batch.
const attack = fixture.alerts[0];
const normal = structuredClone(fixture.alerts[16]);
normal.data.srcip = attack.data.srcip;
const shared = await respond({ alerts: [attack, normal], now: time, persist: false });
assert.equal(shared.proposedBlocks, 0);
assert.equal(decide(normal).action, 'record');

// A plain CVE search is insufficient for automatic blocking.
const educational = { rule: { level: 7, mitre: ['T1190'], description: '취약점 수업' },
  data: { url: '/search?q=CVE-2021-44228' } };
assert.notEqual(decide(educational).action, 'block');

console.log('PASS: 24건 분류 / block=8 alert=8 record=8 / 정상 block=0');
console.log('PASS: 독립 decide, 4개 근거 패턴, 읽기 24줄, 만료 거부 후보 8개, 동일 IP 정상 요청 보호');
