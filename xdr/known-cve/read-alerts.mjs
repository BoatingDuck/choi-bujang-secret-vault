// Human-readable Wazuh fixture inspection only. decide.mjs NEVER imports it.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

function safeText(value, limit = 200) {
  if (typeof value !== 'string') return '-';
  // Never print payloads or secret-like material from a description.
  return value
    .replace(/\$\{[^\r\n}]{0,1024}\}/g, '[redacted]')
    .replace(/\b(?:https?:\/\/)[^\s,;]+/gi, '[redacted-url]')
    .replace(/\b(?:sk|pk)[-_][A-Za-z0-9_-]{16,}\b/g, '[redacted]')
    .replace(/\b(?:bearer|basic)\s+[^\s,;]+/gi, '[redacted]')
    .replace(/\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|authorization)\s*[:=]\s*['"]?[^\s,;'"}]+/gi, '[redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, limit);
}

export function readAlerts(alerts) {
  if (!Array.isArray(alerts)) throw new TypeError('Wazuh alerts 배열이 필요합니다');
  return alerts.map(alert => ({
    timestamp: /^\d{4}-\d\d-\d\dT[\d:.+-]+$/.test(alert?.timestamp ?? '') ? alert.timestamp : '-',
    sourceIp: typeof alert?.data?.srcip === 'string' && alert.data.srcip.split('.').length === 4
      && alert.data.srcip.split('.').every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
      ? alert.data.srcip : '-',
    account: typeof alert?.data?.srcuser === 'string'
      ? (/^user\d{1,6}$/i.test(alert.data.srcuser) ? alert.data.srcuser : '[redacted]') : '-',
    level: Number.isInteger(alert?.rule?.level) && alert.rule.level >= 0 ? alert.rule.level : null,
    description: safeText(alert?.rule?.description)
  }));
}

export async function inspectFixture() {
  const fixture = JSON.parse(await readFile(new URL('../fixtures/known-cve.json', import.meta.url), 'utf8'));
  if (!Array.isArray(fixture.alerts)) throw new Error('경보 배열이 없습니다');
  const lines = readAlerts(fixture.alerts);
  if (fixture.alerts.length !== lines.length) throw new Error('경보 수와 읽은 줄 수가 일치하지 않습니다');
  console.error(`경보 ${fixture.alerts.length}건 / 추출 ${lines.length}줄`);
  for (const line of lines) console.log(JSON.stringify(line));
  return lines;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await inspectFixture();
}
