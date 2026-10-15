// XDR-06: OFFLINE destination-denial proposal adapter, not an active ZTNA policy mutation.
// A trusted engine must map proposals to verified egress policy targets before enforcement.
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from './decide.mjs';

const RULE_FILE = new URL('./deny-rules.json', import.meta.url);
const LOG_FILE = new URL('../alerts.log', import.meta.url);
const FIXTURE = new URL('../fixtures/exfiltration.json', import.meta.url);
const validId = id => typeof id === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(id);
const validIp = ip => typeof ip === 'string' && ip.split('.').length === 4 &&
  ip.split('.').every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255) &&
  ip !== '0.0.0.0' && ip !== '255.255.255.255';

export async function respond({ alerts, now = new Date(), ttlMinutes = 15, persist = true } = {}) {
  if (!Array.isArray(alerts)) throw new TypeError('alerts 배열이 필요합니다');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('올바른 now 시각이 필요합니다');
  if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 60) {
    throw new RangeError('ttlMinutes는 1~60분이어야 합니다');
  }

  const observations = alerts.map(alert => ({ alert, result: decide(alert) }));
  // Destination-based controls must not blacklist an IP observed in known clean traffic
  // within the same batch. No broad source-IP or user-denial rule is created.
  const cleanDestinations = new Set(observations.filter(x => x.result.action === 'record')
    .map(x => x.alert?.data?.dstip ?? x.alert?.data?.destinationIp).filter(validIp));
  const rules = [];
  const logs = [];
  for (const { alert, result } of observations) {
    const dest = alert?.data?.dstip ?? alert?.data?.destinationIp;
    const id = alert?.id;
    const eligible = result.action === 'block' && result.confidence >= 0.85 && validIp(dest) &&
      validId(id) && !cleanDestinations.has(dest) && dest !== alert?.data?.srcip;
    if (eligible) {
      rules.push({
        action: 'deny', scope: 'destination_egress_candidate', targetDestinationIp: dest,
        evidenceAlertId: id, expiresAt: new Date(now.getTime() + ttlMinutes * 60_000).toISOString(),
        reason: result.reason, requiresTrustedPolicyIntegration: true
      });
    }
    if (result.action !== 'record') {
      // Only evidence ID and classification: no raw traffic, user, destination or payload in alerts.log.
      logs.push(JSON.stringify({
        at: now.toISOString(), module: 'exfiltration', alertId: validId(id) ? id : 'unknown',
        action: result.action, reason: result.reason, denyProposed: eligible
      }));
    }
  }
  if (persist) {
    await writeFile(RULE_FILE, JSON.stringify({ schema: 'aleph.xdr.deny-proposals.v1', rules }, null, 2) + '\n', 'utf8');
    if (logs.length) await appendFile(LOG_FILE, logs.join('\n') + '\n', 'utf8');
  }
  return { proposedBlocks: rules.length, alertsLogged: logs.length, rules };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'));
  if (fixture?.schema !== 'aleph.xdr.fixture.v1' || fixture.moduleKey !== 'exfiltration' || !Array.isArray(fixture.alerts)) {
    throw new Error('exfiltration 경보 형식이 아닙니다');
  }
  const out = await respond({ alerts: fixture.alerts });
  console.log(JSON.stringify({ proposedBlocks: out.proposedBlocks, alertsLogged: out.alertsLogged }));
}
