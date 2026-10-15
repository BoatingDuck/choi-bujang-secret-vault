// Offline session-revocation DENY proposals only. No active ZTNA policy mutations.
// Actual session revocation requires trusted mapping to a verified session ID.
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { decide } from './decide.mjs';

const FILE = new URL('./deny-rules.json', import.meta.url);
const LOG = new URL('../alerts.log', import.meta.url);
const FIXTURE = new URL('../fixtures/privilege.json', import.meta.url);
const validAccount = value => typeof value === 'string' && /^(?:user\d{1,8}|admin\d{1,8}|svc-lab)$/.test(value);
const validAlertId = value => typeof value === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(value);
const validIp = ip => typeof ip === 'string' && ip.split('.').length === 4 &&
  ip.split('.').every(p => /^\d{1,3}$/.test(p) && Number(p) <= 255);
const pairKey = (account, ip) => `${account}\0${ip}`;

export async function respond({ alerts, now = new Date(), ttlMinutes = 15, persist = true } = {}) {
  if (!Array.isArray(alerts)) throw new TypeError('alerts 배열이 필요합니다');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('시각이 올바르지 않습니다');
  if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 60) {
    throw new RangeError('만료 시간은 1~60분이어야 합니다');
  }

  const observed = alerts.map(alert => ({ alert, verdict: decide(alert) }));
  // A clean event from the *same account and source* blocks a broad-session
  // proposal; other accounts behind a shared NAT must remain unaffected.
  const cleanPairs = new Set(observed.filter(x => x.verdict.action === 'record')
    .filter(x => validAccount(x.alert?.data?.srcuser) && validIp(x.alert?.data?.srcip))
    .map(x => pairKey(x.alert.data.srcuser, x.alert.data.srcip)));
  const rules = [];
  const lines = [];
  for (const { alert, verdict } of observed) {
    const account = alert?.data?.srcuser;
    const sourceIp = alert?.data?.srcip;
    const alertId = alert?.id;
    const eligible = verdict.action === 'block' && verdict.confidence >= 0.85 &&
      validAccount(account) && validIp(sourceIp) && validAlertId(alertId) &&
      !cleanPairs.has(pairKey(account, sourceIp));
    if (eligible) {
      rules.push({
        action: 'deny', scope: 'account_source_session_candidate',
        targetAccount: account, sourceIp, evidenceAlertId: alertId,
        expiresAt: new Date(now.getTime() + ttlMinutes * 60_000).toISOString(),
        reason: verdict.reason, requiresTrustedSessionMapping: true
      });
    }
    if (verdict.action !== 'record') {
      // No raw command, account name, token, or source IP is ever written to alerts.log.
      lines.push(JSON.stringify({
        at: now.toISOString(), module: 'privilege', alertId: validAlertId(alertId) ? alertId : 'unknown',
        action: verdict.action, reason: verdict.reason, denyProposed: eligible
      }));
    }
  }
  if (persist) {
    await writeFile(FILE, JSON.stringify({ schema: 'aleph.xdr.deny-proposals.v1', rules }, null, 2) + '\n', 'utf8');
    if (lines.length) await appendFile(LOG, lines.join('\n') + '\n', 'utf8');
  }
  return { proposedBlocks: rules.length, alertsLogged: lines.length, rules };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'));
  if (fixture?.schema !== 'aleph.xdr.fixture.v1' || fixture.moduleKey !== 'privilege' || !Array.isArray(fixture.alerts)) {
    throw new Error('privilege 경보 묶음 형식이 아닙니다');
  }
  const result = await respond({ alerts: fixture.alerts });
  console.log(JSON.stringify({ proposedBlocks: result.proposedBlocks, alertsLogged: result.alertsLogged }));
}
