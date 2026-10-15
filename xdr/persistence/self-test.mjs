// Offline fixture and negative-safety tests. No external packages or write side-effects.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decide } from './decide.mjs';
import { readAlerts } from './read-alerts.mjs';
import { respond } from './respond.mjs';

const fixture = JSON.parse(await readFile(new URL('../fixtures/persistence.json', import.meta.url), 'utf8'));
assert.equal(fixture.schema, 'aleph.xdr.fixture.v1');
assert.equal(fixture.moduleKey, 'persistence');
assert.equal(fixture.alerts.length, 24, '원본 경보 건수가 달라졌다면 다시 검토하세요');
assert.equal(readAlerts(fixture.alerts).length, fixture.alerts.length);

const counts = { block: 0, alert: 0, record: 0 };
const reasonNames = new Set(JSON.parse(await readFile(new URL('./patterns.json', import.meta.url), 'utf8')).map(p => p.name));
for (const alert of fixture.alerts) {
  const result = decide(alert);
  const number = Number(alert.id.slice(3)); // Used by TEST ONLY, never by decide.mjs.
  const expected = number <= 8 ? 'block' : number <= 16 ? 'alert' : 'record';
  assert.equal(result.action, expected, `오분류: ${alert.id}`);
  assert.equal(result.action, result.confidence >= 0.85 ? 'block' : result.confidence >= 0.5 ? 'alert' : 'record');
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0 && !result.reason.includes('\n'));
  assert.ok(result.reason === 'no_persistence_pattern' || reasonNames.has(result.reason));
  assert.ok(Number.isFinite(result.confidence) && result.confidence >= 0 && result.confidence <= 1);
  counts[result.action] += 1;
}
assert.deepEqual(counts, { block: 8, alert: 8, record: 8 });

const source = await readFile(new URL('./decide.mjs', import.meta.url), 'utf8');
assert.ok(!/^\s*(?:import|export\s+\*\s+from)\s/m.test(source), 'decide.mjs 외부 의존성이 있습니다');
assert.ok(!/\b(?:readFile|writeFile|appendFile|fetch|require)\s*\(/.test(source), 'decide.mjs가 I/O를 수행합니다');
const patterns = JSON.parse(await readFile(new URL('./patterns.json', import.meta.url), 'utf8'));
assert.equal(patterns.length, 7);
for (const p of patterns) {
  assert.ok(typeof p.name === 'string' && p.name.length > 0);
  assert.ok(typeof p.condition === 'string' && p.condition.length > 0);
  assert.ok(typeof p.evidence === 'string' && p.evidence.length > 0 && !p.evidence.includes('\n'));
  assert.ok(source.includes(`name: '${p.name}'`), `패턴 누락: ${p.name}`);
}
const now = new Date('2026-10-15T01:00:00Z');
const response = await respond({ alerts: fixture.alerts, now, ttlMinutes: 15, persist: false });
assert.equal(response.proposedBlocks, 8);
assert.equal(response.alertsLogged, 16);
assert.ok(response.rules.every(r => r.action === 'deny' && r.evidenceAlertId && r.targetAgentName &&
  r.expiresAt === '2026-10-15T01:15:00.000Z'));
assert.ok(response.rules.every(r => fixture.alerts.slice(0, 8).some(a => a.id === r.evidenceAlertId)));

// Same source IP can host legitimate traffic. Never propose a broad IP deny in that case.
const normal = structuredClone(fixture.alerts[16]);
normal.data.srcip = fixture.alerts[0].data.srcip;
assert.equal(decide(normal).action, 'record');
const shared = await respond({ alerts: [fixture.alerts[0], normal], now, persist: false });
assert.equal(shared.proposedBlocks, 0);

// Technique labels or temp-file presence alone never trigger automatic denial.
const service = structuredClone(fixture.alerts[0]);
service.rule.description = '기존 수업 도구 서비스가 서명된 채로 실행 중입니다.';
service.rule.level = 3;
assert.equal(decide(service).action, 'record');
const tempOnly = structuredClone(fixture.alerts[12]);
assert.equal(decide(tempOnly).action, 'alert');
const taskOnly = structuredClone(fixture.alerts[8]);
assert.equal(decide(taskOnly).action, 'alert');
const noTag = structuredClone(fixture.alerts[0]);
noTag.rule.mitre = [];
assert.notEqual(decide(noTag).action, 'block');
const noAgent = structuredClone(fixture.alerts[0]);
delete noAgent.agent;
assert.equal((await respond({ alerts: [noAgent], now, persist: false })).proposedBlocks, 0);
// No confidence inflation just because the alert text mentions a scary name.
assert.equal(decide({ rule: { level: 3, description: 'T1543 공격' }, data: { path: 'C:\\Temp\\foo.exe' } }).action, 'record');

console.log(`PASS: ${fixture.alerts.length}건 / block=${counts.block} alert=${counts.alert} record=${counts.record} / 정상 block=0`);
console.log('PASS: 단독 판정기, 패턴 근거 7개, 읽기 24줄, 만료 후보 8개, 공유 IP 안전장치 및 정상 서비스 보호');
