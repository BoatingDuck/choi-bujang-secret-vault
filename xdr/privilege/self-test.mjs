// Purely local regression checks; never calls the actual ZTNA policy engine.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decide } from './decide.mjs';
import { readAlerts } from './read-alerts.mjs';
import { respond } from './respond.mjs';

const fixture = JSON.parse(await readFile(new URL('../fixtures/privilege.json', import.meta.url), 'utf8'));
assert.equal(fixture.schema, 'aleph.xdr.fixture.v1');
assert.equal(fixture.moduleKey, 'privilege');
assert.equal(fixture.alerts.length, 26, '원본 경보 건수가 달라졌습니다. 먼저 비교하세요');
assert.equal(readAlerts(fixture.alerts).length, fixture.alerts.length);
const counts = { block: 0, alert: 0, record: 0 };
const patterns = JSON.parse(await readFile(new URL('./patterns.json', import.meta.url), 'utf8'));
const names = new Set(patterns.map(p => p.name));
const src = await readFile(new URL('./decide.mjs', import.meta.url), 'utf8');
assert.ok(!/^\s*(?:import|export\s+\*\s+from)\s/m.test(src));
assert.ok(!/\b(?:readFile|writeFile|appendFile|require|fetch)\s*\(/.test(src));
for (const pattern of patterns) {
  assert.ok(typeof pattern.name === 'string' && pattern.name.length > 0);
  assert.ok(typeof pattern.condition === 'string' && pattern.condition.length > 0);
  assert.ok(typeof pattern.evidence === 'string' && pattern.evidence.length > 0 && !pattern.evidence.includes('\n'));
  assert.ok(src.includes(`"name": "${pattern.name}"`), `decide.mjs 에 패턴 없음: ${pattern.name}`);
}
for (const alert of fixture.alerts) {
  const verdict = decide(alert);
  assert.ok(Number.isFinite(verdict.confidence) && verdict.confidence >= 0 && verdict.confidence <= 1);
  assert.equal(verdict.action, verdict.confidence >= 0.85 ? 'block' : verdict.confidence >= 0.5 ? 'alert' : 'record');
  assert.ok(names.has(verdict.reason) || verdict.reason === 'no_privilege_abuse_pattern');
  assert.ok(!verdict.reason.includes('\n'));
  const num = Number(alert.id.split('-').at(-1)); // Test-only expected categories, not a classifier rule.
  const expected = num <= 9 ? 'block' : num <= 17 ? 'alert' : 'record';
  assert.equal(verdict.action, expected, `잘못 분류된 경보: ${alert.id}`);
  counts[verdict.action] += 1;
  const renamed = structuredClone(alert);
  renamed.id = 'renamed';
  assert.deepEqual(decide(renamed), verdict, '경보 번호를 보고 정답을 외우면 안 됩니다');
}
assert.deepEqual(counts, { block: 9, alert: 8, record: 9 });
const now = new Date('2026-10-15T02:00:00.000Z');
const out = await respond({ alerts: fixture.alerts, now, ttlMinutes: 15, persist: false });
assert.equal(out.proposedBlocks, 9);
assert.equal(out.alertsLogged, 17);
assert.ok(out.rules.every(r => r.action === 'deny' && r.scope === 'account_source_session_candidate' &&
  r.requiresTrustedSessionMapping === true && r.evidenceAlertId && r.targetAccount &&
  r.expiresAt === '2026-10-15T02:15:00.000Z'));
assert.ok(out.rules.every(r => fixture.alerts.slice(0, 9).some(a => a.id === r.evidenceAlertId)));
// A harmless event from this same account at this source prevents even a scoped candidate.
const normal = structuredClone(fixture.alerts[17]);
normal.data.srcip = fixture.alerts[0].data.srcip;
const shared = await respond({ alerts: [fixture.alerts[0], normal], now, persist: false });
assert.equal(shared.proposedBlocks, 0);
// A different account sharing the IP must not be included in the candidate.
const otherAccount = structuredClone(normal);
otherAccount.data.srcuser = 'user99';
const separate = await respond({ alerts: [fixture.alerts[0], otherAccount], now, persist: false });
assert.equal(separate.proposedBlocks, 1);
assert.equal(separate.rules[0].targetAccount, fixture.alerts[0].data.srcuser);
// Technique ID and benign admin activity alone are never enough for blocking.
const adminLow = structuredClone(fixture.alerts[0]);
adminLow.rule.level = 3;
assert.equal(decide(adminLow).action, 'record');
const noTechnique = structuredClone(fixture.alerts[0]);
noTechnique.rule.mitre = [];
assert.notEqual(decide(noTechnique).action, 'block');
const labGroup = structuredClone(fixture.alerts[0]);
labGroup.data.group = 'project-week3';
assert.notEqual(decide(labGroup).action, 'block');
const cancelled = structuredClone(fixture.alerts[0]);
cancelled.rule.description = '관리자 그룹 요청은 취소됐습니다';
assert.notEqual(decide(cancelled).action, 'block');
const unknownActor = structuredClone(fixture.alerts[0]);
unknownActor.data.srcuser = 'person@example.org';
assert.equal((await respond({ alerts: [unknownActor], now, persist: false })).proposedBlocks, 0);
console.log(`PASS: ${fixture.alerts.length}건 / block=${counts.block} alert=${counts.alert} record=${counts.record} / 정상 block=0`);
console.log(`PASS: 독립 decide, 패턴 근거 ${patterns.length}개, 읽기 ${fixture.alerts.length}줄, 만료 후보 ${out.proposedBlocks}개, 계정·출발지 범위 및 정상 세션 보호`);
