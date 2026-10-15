// Self-test on supplied training fixture only. Does not assert official judge results.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decide } from './decide.mjs';
import { readAlerts } from './read-alerts.mjs';
import { respond } from './respond.mjs';

const fixture = JSON.parse(await readFile(new URL('../fixtures/exfiltration.json', import.meta.url), 'utf8'));
assert.equal(fixture?.schema, 'aleph.xdr.fixture.v1');
assert.equal(fixture?.moduleKey, 'exfiltration');
assert.equal(fixture.alerts.length, 30, '원본 경보 건수 변경: 재분석 필요');
assert.equal(readAlerts(fixture.alerts).length, fixture.alerts.length);
const patterns = JSON.parse(await readFile(new URL('./patterns.json', import.meta.url), 'utf8'));
assert.equal(patterns.length, 9);
const names = new Set(patterns.map(p => p.name));
const code = await readFile(new URL('./decide.mjs', import.meta.url), 'utf8');
assert.ok(!/^\s*(?:import|export\s+\*\s+from)\s/m.test(code));
assert.ok(!/\b(?:readFile|writeFile|appendFile|require|fetch)\s*\(/.test(code));
for (const p of patterns) {
  assert.ok(typeof p.name === 'string' && p.name.length);
  assert.ok(typeof p.condition === 'string' && p.condition.length);
  assert.ok(typeof p.evidence === 'string' && p.evidence.length && !p.evidence.includes('\n'));
  assert.ok(code.includes('"name": "' + p.name + '"'));
}
const counts = { block: 0, alert: 0, record: 0 };
for (const alert of fixture.alerts) {
  const result = decide(alert);
  const ordinal = Number(alert.id.split('-')[1]); // TEST ONLY: no ID checks in decide.mjs.
  const expected = ordinal <= 10 ? 'block' : ordinal <= 20 ? 'alert' : 'record';
  assert.equal(result.action, expected, `오분류: ${alert.id} (${result.reason})`);
  assert.equal(result.action, result.confidence >= 0.85 ? 'block' : result.confidence >= 0.5 ? 'alert' : 'record');
  assert.ok(Number.isFinite(result.confidence) && result.confidence >= 0 && result.confidence <= 1);
  assert.ok(names.has(result.reason) || result.reason === 'no_exfiltration_pattern');
  assert.ok(!result.reason.includes('\n'));
  counts[result.action] += 1;
  const renamed = structuredClone(alert); renamed.id = 'renamed-example';
  assert.deepEqual(decide(renamed), result, '경보 ID에 의존해서는 안 됩니다');
}
assert.deepEqual(counts, { block: 10, alert: 10, record: 10 });
const now = new Date('2026-10-15T03:00:00.000Z');
const response = await respond({ alerts: fixture.alerts, now, ttlMinutes: 15, persist: false });
assert.equal(response.proposedBlocks, 10);
assert.equal(response.alertsLogged, 20);
assert.ok(response.rules.every(r => r.action === 'deny' && r.scope === 'destination_egress_candidate' &&
  r.evidenceAlertId && r.targetDestinationIp && r.expiresAt === '2026-10-15T03:15:00.000Z' &&
  r.requiresTrustedPolicyIntegration));
assert.ok(response.rules.every(r => fixture.alerts.slice(0, 10).some(a => a.id === r.evidenceAlertId)));

// A normal request from ANY source to a destination blocks a broad destination denial proposal.
const normalSameDestination = structuredClone(fixture.alerts[20]);
normalSameDestination.data.dstip = fixture.alerts[0].data.dstip;
assert.equal(decide(normalSameDestination).action, 'record');
const shared = await respond({ alerts: [fixture.alerts[0], normalSameDestination], now, persist: false });
assert.equal(shared.proposedBlocks, 0);
// Same source with legitimate traffic to another destination must not be source-blocked.
const normalSameSource = structuredClone(fixture.alerts[20]);
normalSameSource.data.srcip = fixture.alerts[0].data.srcip;
const scoped = await respond({ alerts: [fixture.alerts[0], normalSameSource], now, persist: false });
assert.equal(scoped.proposedBlocks, 1);
assert.equal(scoped.rules[0].targetDestinationIp, fixture.alerts[0].data.dstip);
// Large file alone, no ATT&CK evidence, missing destination, bad/zero bytes, or benign events must not be blocked.
const a = fixture.alerts[0];
for (const change of [
  obj => { obj.rule.mitre = []; },
  obj => { obj.rule.level = 3; },
  obj => { obj.data.bytes = '0'; },
  obj => { obj.data.bytes = '-100'; },
  obj => { obj.data.dstip = undefined; },
  obj => { obj.rule.description = '기존 자료 서버에 승인된 수업 자료 전송입니다.'; }
]) {
  const copy = structuredClone(a); change(copy);
  assert.notEqual(decide(copy).action, 'block');
}
assert.notEqual(decide(fixture.alerts[13]).action, 'block');
assert.notEqual(decide(fixture.alerts[17]).action, 'block');
assert.equal(decide(fixture.alerts[22]).action, 'record');
console.log(`PASS: ${fixture.alerts.length}건 / block=${counts.block} alert=${counts.alert} record=${counts.record} / 정상 block=0`);
console.log(`PASS: 독립 decide, 패턴 ${patterns.length}개, 만료 목적지 거부 후보 ${response.proposedBlocks}개, 알림 ${response.alertsLogged}건, 정상 목적지 보호`);
