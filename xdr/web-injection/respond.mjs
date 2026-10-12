// Offline deny proposals only; does not change existing ZTNA policy or SDP contract.
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { decide } from './decide.mjs';
const folder = new URL('./', import.meta.url);
export async function respond({ alerts, now = new Date(), ttlMinutes = 15 } = {}) {
  if (!Array.isArray(alerts)) throw new TypeError('alerts 배열이 필요합니다');
  const proposals = [];
  const lines = [];
  for (const alert of alerts) {
    const verdict = decide(alert);
    const sourceIp = alert?.data?.srcip;
    const id = alert?.id;
    const validIp = typeof sourceIp === 'string' && /^(\d{1,3}\.){3}\d{1,3}$/.test(sourceIp) && sourceIp.split('.').every(n => +n <= 255);
    const validId = typeof id === 'string' && /^[A-Za-z0-9-]+$/.test(id);
    // Only high confidence, repeated attacks become deny rule candidates.
    if (verdict.action === 'block' && verdict.confidence >= 0.85 && Number(alert?.data?.count) >= 8 && validIp && validId) {
      proposals.push({ action: 'deny', sourceIp, evidenceAlertId: id,
        expiresAt: new Date(now.getTime() + ttlMinutes * 60_000).toISOString(), reason: verdict.reason });
    }
    if (verdict.action !== 'record') {
      lines.push(JSON.stringify({ at: now.toISOString(), module: 'web-injection', alertId: validId ? id : 'unknown', action: verdict.action, reason: verdict.reason }));
    }
  }
  await writeFile(new URL('./deny-rules.json', folder), JSON.stringify({ schema: 'aleph.xdr.deny-proposals.v1', rules: proposals }, null, 2) + '\n');
  if (lines.length) await appendFile(new URL('../alerts.log', folder), lines.join('\n') + '\n');
  return { proposedBlocks: proposals.length, alertsLogged: lines.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fixture = JSON.parse(await readFile(new URL('../fixtures/web-injection.json', folder), 'utf8'));
  console.log(JSON.stringify(await respond({ alerts: fixture.alerts })));
}
