import { readFile } from 'node:fs/promises';
const fixtureUrl = new URL('../fixtures/brute-force.json', import.meta.url);
const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));
if (!Array.isArray(fixture.alerts)) throw new Error('alerts 배열이 없습니다.');
const projected = fixture.alerts.map(alert => ({
  timestamp: alert?.timestamp ?? null,
  sourceIp: alert?.data?.srcip ?? null,
  account: alert?.data?.srcuser ?? null,
  ruleLevel: alert?.rule?.level ?? null,
  description: alert?.rule?.description ?? null
}));
// Explicit allowlist: no password, token, or other original data fields.
for (const entry of projected) console.log(JSON.stringify(entry));
console.error(`경보 ${fixture.alerts.length}건 / 추출 ${projected.length}줄`);
