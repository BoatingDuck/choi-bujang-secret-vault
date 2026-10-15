// Creates OFFLINE expiring deny proposals for an external ZTNA policy-adapter.
// This does not mutate src/decider.mjs or the active engine's policy registry.
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { decide } from './decide.mjs';

const RULE_FILE = new URL('./deny-rules.json', import.meta.url);
const ALERT_LOG = new URL('../alerts.log', import.meta.url);
const FIXTURE_FILE = new URL('../fixtures/known-cve.json', import.meta.url);

function validIpv4(value) {
  if (typeof value !== 'string') return false;
  const octets = value.split('.');
  return octets.length === 4 && octets.every(o => /^\d{1,3}$/.test(o) && Number(o) <= 255);
}

export async function respond({ alerts, now = new Date(), ttlMinutes = 15, persist = true } = {}) {
  if (!Array.isArray(alerts)) throw new TypeError('alerts 배열이 필요합니다');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('now 시각이 올바르지 않습니다');
  if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 60) throw new RangeError('ttlMinutes는 1~60이어야 합니다');

  const decisions = alerts.map(alert => ({ alert, verdict: decide(alert) }));
  // A single IP may be shared (e.g. NAT). Never create a blanket IP-deny
  // proposal when the same fixture includes a normal request from that IP.
  const normalIps = new Set(decisions.filter(x => x.verdict.action === 'record')
    .map(x => x.alert?.data?.srcip).filter(validIpv4));
  const proposals = [];
  const lines = [];
  for (const { alert, verdict } of decisions) {
    const ip = alert?.data?.srcip;
    const id = alert?.id;
    const validId = typeof id === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(id);
    const eligible = verdict.action === 'block' && verdict.confidence >= 0.85 &&
      validIpv4(ip) && validId && !normalIps.has(ip);
    if (eligible) {
      proposals.push({
        action: 'deny', sourceIp: ip, evidenceAlertId: id,
        expiresAt: new Date(now.getTime() + ttlMinutes * 60_000).toISOString(),
        reason: verdict.reason
      });
    }
    if (verdict.action !== 'record') {
      // NEVER log raw URLs, headers, usernames, tokens, or payloads.
      lines.push(JSON.stringify({
        at: now.toISOString(), module: 'known-cve', alertId: validId ? id : 'unknown',
        action: verdict.action, reason: verdict.reason, denyProposed: eligible
      }));
    }
  }
  if (persist) {
    await writeFile(RULE_FILE, JSON.stringify({ schema: 'aleph.xdr.deny-proposals.v1', rules: proposals }, null, 2) + '\n', 'utf8');
    if (lines.length) await appendFile(ALERT_LOG, lines.join('\n') + '\n', 'utf8');
  }
  return { proposedBlocks: proposals.length, alertsLogged: lines.length, rules: proposals };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fixture = JSON.parse(await readFile(FIXTURE_FILE, 'utf8'));
  const out = await respond({ alerts: fixture.alerts });
  // Do not print source addresses or full deny rules on the console.
  console.log(JSON.stringify({ proposedBlocks: out.proposedBlocks, alertsLogged: out.alertsLogged }));
}
