import { readFile } from 'node:fs/promises';
const fixture = JSON.parse(await readFile(new URL('../fixtures/web-injection.json', import.meta.url), 'utf8'));
if (!Array.isArray(fixture.alerts)) throw new Error('alerts 배열이 없습니다');
let extracted = 0;
for (const a of fixture.alerts) {
  // Deliberately only emit the specified, allowlisted fields. Never print URL/query/body.
  const row = {
    timestamp: a?.timestamp ?? null,
    sourceIp: a?.data?.srcip ?? null,
    account: a?.data?.srcuser ?? null,
    ruleLevel: a?.rule?.level ?? null,
    description: a?.rule?.description ?? null,
  };
  console.log(JSON.stringify(row));
  extracted++;
}
console.log(`경보 ${fixture.alerts.length}건 / 추출 ${extracted}줄`);
