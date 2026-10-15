// XDR-04 OFFLINE policy proposal adapter: never changes the active ZTNA contract.
// It supplies expiring, evidence-linked candidate denials for a separately trusted integrator.
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { decide } from './decide.mjs';

const DENY_FILE = new URL('./deny-rules.json', import.meta.url);
const LOG_FILE = new URL('../alerts.log', import.meta.url);
const FIXTURE_FILE = new URL('../fixtures/persistence.json', import.meta.url);
const validIp = ip => typeof ip === 'string' &&
  ip.split('.').length === 4 && ip.split('.').every(x => /^\d{1,3}$/.test(x) && Number(x) <= 255);
const validId = id => typeof id === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(id);
const validAgent = name => typeof name === 'string' && /^[a-zA-Z][a-zA-Z0-9-]{2,63}$/.test(name);

export async function respond({ alerts, now = new Date(), ttlMinutes = 15, persist = true } = {}) {
  if (!Array.isArray(alerts)) throw new TypeError('alerts 배열이 필요합니다');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('시각이 올바르지 않습니다');
  if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 60) {
    throw new RangeError('거부 후보 유효 시간은 1~60분이어야 합니다');
  }

  const decisions = alerts.map(alert => ({ alert, verdict: decide(alert) }));
  // Source IP may represent a shared NAT. An explicit normal record at that
  // address prevents a broad source-IP denial candidate from being proposed.
  const normalIps = new Set(decisions.filter(item => item.verdict.action === 'record')
    .map(item => item.alert?.data?.srcip).filter(validIp));
  const rules = [];
  const lines = [];
  for (const { alert, verdict } of decisions) {
    const ip = alert?.data?.srcip;
    const id = alert?.id;
    const agent = alert?.agent?.name;
    const eligible = verdict.action === 'block' && verdict.confidence >= 0.85 &&
      validIp(ip) && validId(id) && validAgent(agent) && !normalIps.has(ip);
    if (eligible) {
      rules.push({
        action: 'deny', sourceIp: ip, targetAgentName: agent,
        evidenceAlertId: id, expiresAt: new Date(now.getTime() + ttlMinutes * 60_000).toISOString(),
        reason: verdict.reason
      });
    }
    if (verdict.action !== 'record') {
      // Log alert IDs and classification only; never raw file paths or usernames.
      lines.push(JSON.stringify({
        at: now.toISOString(), module: 'persistence', alertId: validId(id) ? id : 'unknown',
        action: verdict.action, reason: verdict.reason, denyProposed: eligible
      }));
    }
  }
  if (persist) {
    await writeFile(DENY_FILE, `${JSON.stringify({ schema: 'aleph.xdr.deny-proposals.v1', rules }, null, 2)}\n`, 'utf8');
    if (lines.length) await appendFile(LOG_FILE, lines.join('\n') + '\n', 'utf8');
  }
  return { proposedBlocks: rules.length, alertsLogged: lines.length, rules };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fixture = JSON.parse(await readFile(FIXTURE_FILE, 'utf8'));
  if (fixture?.schema !== 'aleph.xdr.fixture.v1' || fixture.moduleKey !== 'persistence' || !Array.isArray(fixture.alerts)) {
    throw new Error('persistence 경보 묶음 형식이 아닙니다');
  }
  const outcome = await respond({ alerts: fixture.alerts });
  console.log(JSON.stringify({ proposedBlocks: outcome.proposedBlocks, alertsLogged: outcome.alertsLogged }));
}
