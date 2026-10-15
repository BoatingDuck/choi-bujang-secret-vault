// Human-readable Wazuh fixture inspection ONLY; decide.mjs does not import this file.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

function safeText(value, limit = 200) {
  if (typeof value !== 'string') return '-';
  return value
    .replace(/\$\{[^\r\n}]{0,1024}\}/g, '[redacted]')
    .replace(/\b(?:https?:\/\/)[^\s,;]+/gi, '[redacted-url]')
    .replace(/\b(?:sk|pk)[-_][A-Za-z0-9_-]{16,}\b/g, '[redacted]')
    .replace(/\b(?:bearer|basic)\s+[^\s,;]+/gi, '[redacted]')
    .replace(/\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|authorization)\s*[:=]\s*['"]?[^\s,;'"}]+/gi, '[redacted]')
    .replace(/\b(?:[a-z0-9._%+-]+)@(?:[a-z0-9.-]+\.[a-z]{2,})\b/gi, '[redacted-email]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, limit);
}

function validIp(ip) {
  if (typeof ip !== 'string') return false;
  const parts = ip.split('.');
  return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

export function readAlerts(alerts) {
  if (!Array.isArray(alerts)) throw new TypeError('Wazuh alerts 배열이 필요합니다');
  return alerts.map(alert => ({
    timestamp: /^\d{4}-\d\d-\d\dT[\d:.+-]+$/.test(alert?.timestamp ?? '') ? alert.timestamp : '-',
    sourceIp: validIp(alert?.data?.srcip) ? alert.data.srcip : '-',
    account: /^(?:user\d{1,8}|admin\d{1,8}|svc-lab)$/.test(alert?.data?.srcuser ?? '')
      ? alert.data.srcuser : '[redacted]',
    level: Number.isInteger(alert?.rule?.level) && alert.rule.level >= 0 ? alert.rule.level : null,
    description: safeText(alert?.rule?.description)
  }));
}

export async function inspectFixture() {
  const fixture = JSON.parse(await readFile(new URL('../fixtures/privilege.json', import.meta.url), 'utf8'));
  if (fixture?.schema !== 'aleph.xdr.fixture.v1' || fixture.moduleKey !== 'privilege' || !Array.isArray(fixture.alerts)) {
    throw new Error('privilege 경보 묶음 형식이 아닙니다');
  }
  const lines = readAlerts(fixture.alerts);
  if (lines.length !== fixture.alerts.length) throw new Error('경보 건수와 추출 줄 수가 다릅니다');
  console.error(`경보 ${fixture.alerts.length}건 / 추출 ${lines.length}줄`);
  for (const line of lines) console.log(JSON.stringify(line));
  return lines;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await inspectFixture();
}
