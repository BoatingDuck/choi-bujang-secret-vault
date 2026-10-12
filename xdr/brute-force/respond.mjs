// Offline response adapter. Produces an expiring ZTNA deny-rule proposal;
// it does NOT mutate the established SDP decision contract or live policy.
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { decide } from './decide.mjs';
const folder = new URL('./', import.meta.url);
export async function respond({ alerts, now = new Date(), ttlMinutes = 15 } = {}) {
  if (!Array.isArray(alerts)) throw new TypeError('alerts 배열이 필요합니다');
  const denyRules = [];
  const lines = [];
  for (const alert of alerts) {
    const verdict = decide(alert);
    const ip = alert?.data?.srcip;
    const id = alert?.id;
    const validIp = typeof ip === 'string' && /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip.split('.').every(x => Number(x) <= 255);
    const validId = typeof id === 'string' && /^[a-zA-Z0-9-]+$/.test(id);
    if (verdict.action === 'block' && validIp && validId) {
      denyRules.push({ action: 'deny', sourceIp: ip, evidenceAlertId: id,
        expiresAt: new Date(now.getTime() + ttlMinutes * 60_000).toISOString(),
        reason: verdict.reason });
    }
    if (verdict.action !== 'record') lines.push(JSON.stringify({
      at: now.toISOString(), module: 'brute-force', alertId: validId ? id : 'unknown',
      action: verdict.action, reason: verdict.reason
    }));
  }
  // A separate policy-proposal file keeps the original ZTNA policy untouched.
  await writeFile(new URL('./deny-rules.json', folder), JSON.stringify({ schema: 'aleph.xdr.deny-proposals.v1', rules: denyRules }, null, 2) + '\n');
  if (lines.length) await appendFile(new URL('../alerts.log', folder), lines.join('\n') + '\n');
  return { proposedBlocks: denyRules.length, alertsLogged: lines.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fixture = JSON.parse(await readFile(new URL('../fixtures/brute-force.json', folder), 'utf8'));
  console.log(JSON.stringify(await respond({ alerts: fixture.alerts })));
}
