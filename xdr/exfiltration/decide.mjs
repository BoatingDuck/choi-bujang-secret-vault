// XDR-06 independent offline classifier: NO import, external packages, file/network I/O.
// PATTERNS duplicates xdr/exfiltration/patterns.json for the isolated judge.
const PATTERNS = Object.freeze([
  {
    "name": "unfamiliar_bulk_destination",
    "condition": "T1041/T1048 수준 10 이상, 5천만 바이트 이상의 실제 반출이 평소에 없던 목적지로 향하고 대량 파일 또는 자료 묶음 신호가 동반될 때",
    "evidence": "MITRE ATT&CK T1041/T1048: 기존 C2 또는 대체 통로로 외부 대용량 유출; 새 목적지와 자료 대량 반출의 결합이 중요"
  },
  {
    "name": "offhours_archive_unfamiliar_destination",
    "condition": "T1048 고수준 경보에서 수업·업무 시간 밖 압축 파일을 처음 보는 목적지로 5천만 바이트 이상 전송했을 때",
    "evidence": "MITRE ATT&CK T1048: 비정상 시각의 아카이브 반출과 미확인 목적지의 조합은 유출 징후"
  },
  {
    "name": "repeated_c2_large_egress",
    "condition": "T1041 고수준 경보에서 명령 통로 또는 같은 목적지로 대용량 전송이 8회 이상 반복될 때",
    "evidence": "MITRE ATT&CK T1041: C2 통로를 통한 반복·대량 외부 전송은 유출 징후"
  },
  {
    "name": "unusual_port_repeated_bulk_transfer",
    "condition": "T1048 고수준 경보에서 평소 쓰지 않던 포트를 통해 자료를 연속으로 대량 전송할 때",
    "evidence": "MITRE ATT&CK T1048: 비정상 프로토콜·포트 사용과 대량 반출의 결합"
  },
  {
    "name": "offhours_repeated_mass_transfer",
    "condition": "T1048 고수준 경보에서 업무 시간 밖 동일 목적지로 8회 이상의 대량 반출이 반복될 때",
    "evidence": "MITRE ATT&CK T1048: 업무 시간 외 비정상 빈도 및 대량 외부 전송"
  },
  {
    "name": "repeated_archives_to_new_destination",
    "condition": "T1048 고수준 경보에서 압축 파일 여러 개가 연속으로 처음 보는 주소로 대량 전송될 때",
    "evidence": "MITRE ATT&CK T1048: 아카이브를 이용한 연속적 비정상 목적지 반출"
  },
  {
    "name": "rapid_whole_repository_export",
    "condition": "T1041 고수준 경보에서 짧은 시간에 자료실 전체 또는 대량 파일을 외부 목적지로 복사할 때",
    "evidence": "MITRE ATT&CK T1041: 짧은 시간에 전체 데이터 집합이 외부로 이동하는 고위험 대량 유출"
  },
  {
    "name": "same_archive_multiple_new_destinations",
    "condition": "T1048 고수준 경보에서 같은 압축 파일이 처음 보는 목적지 두 곳 이상에 대량 전송될 때",
    "evidence": "MITRE ATT&CK T1048: 비정상적인 복수 목적지로 같은 아카이브를 반출하는 행위"
  },
  {
    "name": "external_transfer_needs_review",
    "condition": "T1041/T1048 수준 5 이상 경보에 전송량 증가·새 주소·압축·실패 등의 정황은 있으나 명확한 대량 반출 근거는 부족할 때 알림만 남김",
    "evidence": "MITRE ATT&CK T1041/T1048: 기술 태그·단발 전송·압축 파일 생성만으로 유출 확정은 불가하며 정상 운영을 오차단하지 않아야 함"
  }
]);

const lower = value => typeof value === 'string' ? value.slice(0, 4096).toLowerCase() : '';
const hasTechnique = (tags, id) => Array.isArray(tags) && tags.some(value =>
  typeof value === 'string' && (value === id || value.startsWith(id + '.')));
const validIp = value => typeof value === 'string' && value.split('.').length === 4 &&
  value.split('.').every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255) &&
  value !== '0.0.0.0' && value !== '255.255.255.255';
const positiveInteger = value => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
const verdict = (confidence, reason) => ({
  action: confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record',
  confidence, reason
});

export function decide(alert) {
  const rule = alert && typeof alert === 'object' ? alert.rule : null;
  const data = alert && typeof alert === 'object' ? alert.data : null;
  const desc = lower(rule?.description);
  const level = Number(rule?.level);
  const t1041 = hasTechnique(rule?.mitre, 'T1041');
  const t1048 = hasTechnique(rule?.mitre, 'T1048');
  const reviewed = Number.isFinite(level) && level >= 5 && (t1041 || t1048);
  const high = Number.isFinite(level) && level >= 10 && (t1041 || t1048);
  const bytes = positiveInteger(data?.bytes);
  const files = positiveInteger(data?.files);
  const count = positiveInteger(data?.count);
  const dest = data?.dstip ?? data?.destinationIp;
  const hasDestination = validIp(dest) && dest !== data?.srcip;
  // Thresholds are conservative heuristics for this fixture, not universal exfiltration cutoffs.
  const bulk = bytes !== null && bytes >= 50_000_000;
  const manyFiles = files !== null && files >= 50;
  const repeated = count !== null && count >= 8;
  const unfamiliar = /처음\s*보는\s*(?:목적지|주소)|평소와\s*다른\s*(?:목적지|주소)|낯선\s*(?:목적지|주소)|(?:unfamiliar|new|unknown)\s+(?:destination|address|endpoint)/.test(desc);
  const offhours = /수업\s*시간\s*밖|업무\s*시간\s*밖|근무\s*시간\s*외|업무\s*외\s*시간|(?:off.hours|outside\s+(?:business|working|class)\s+hours)/.test(desc);
  const archive = /압축\s*파일|압축\s*자료|(?:archive|zip)\s+(?:file|transfer)/.test(desc);
  const commandChannel = /명령\s*통로|\bc2\b|command.and.control/.test(desc);
  const unusualPort = /평소에?\s*쓰지\s*않던\s*포트|낯선\s*포트|(?:unusual|non.standard)\s+port/.test(desc);
  const consecutive = /연속|반복|(?:repeated|consecutive)/.test(desc);
  const multipleDestinations = /목적지\s*두\s*곳|주소\s*두\s*곳|여러\s*목적지|multiple\s+destinations/.test(desc);
  const wholeRepository = /자료실\s*전체|자료\s*전체|전체\s*자료|(?:whole|entire)\s+(?:dataset|repository)/.test(desc);
  const fast = /짧은\s*시간|10분\s*안|(?:short\s+time|within\s+10\s+minutes)/.test(desc);
  const copiedOut = /외부\s*주소로\s*복사|외부\s*목적지로\s*복사|밖으로\s*복사|copied\s+(?:out|outside)/.test(desc);
  const outbound = /나갔|전송|반출|유출|올라갔|복사됐|복사되었|(?:sent|uploaded|transferred|exfiltrat)/.test(desc);
  const nonTransfer = /전송(?:은|이)?\s*(?:아직\s*)?없|전송이\s*실패|실패\s*1건|나가지\s*않|(?:not\s+transferred|transfer\s+failed|no\s+external\s+transfer)/.test(desc);
  const bulkCollection = /자료\s*\d+건|메모\s*묶음|자료\s*묶음|파일\s*\d+개|대용량|큰\s*파일|(?:bulk|large)\s+(?:file|data|transfer)/.test(desc);

  // Never auto-block a failed transfer, empty/non-positive byte count, or missing destination.
  if (high && bulk && hasDestination && outbound && !nonTransfer) {
    if (t1048 && archive && multipleDestinations && unfamiliar) {
      return verdict(0.97, PATTERNS[7].name);
    }
    if (t1048 && offhours && archive && unfamiliar) {
      return verdict(0.98, PATTERNS[1].name);
    }
    if (t1041 && wholeRepository && (fast || copiedOut || manyFiles)) {
      return verdict(0.99, PATTERNS[6].name);
    }
    if (t1041 && repeated && consecutive && (commandChannel || /대용량|큰\s*파일/.test(desc))) {
      return verdict(0.97, PATTERNS[2].name);
    }
    if (t1048 && unusualPort && consecutive && (manyFiles || bulk)) {
      return verdict(0.96, PATTERNS[3].name);
    }
    if (t1048 && offhours && repeated && (consecutive || /전송이\s*\d+번/.test(desc))) {
      return verdict(0.96, PATTERNS[4].name);
    }
    if (t1048 && unfamiliar && archive && consecutive && (files !== null && files >= 2)) {
      return verdict(0.96, PATTERNS[5].name);
    }
    if (unfamiliar && (manyFiles || bulkCollection)) {
      return verdict(0.95, PATTERNS[0].name);
    }
  }
  // Technique label alone is not a blocking signal. A normal low-level sync is record.
  if (reviewed) return verdict(0.60, PATTERNS[8].name);
  return verdict(0.10, 'no_exfiltration_pattern');
}
