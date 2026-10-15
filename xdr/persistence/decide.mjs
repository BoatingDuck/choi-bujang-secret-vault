// Standalone offline XDR-04 classifier. No imports, packages, network or file I/O.
// PATTERNS are copied from patterns.json; edit the two together if rules change.
const PATTERNS = Object.freeze([
  { name: 'unsigned_service_temp_binary', condition: 'T1543 고수준 경보에서 새로 등록하거나 실행 파일이 바뀐 서비스의 서명이 없고 실행 경로가 임시 폴더일 때', evidence: 'MITRE ATT&CK T1543.003: 악성 지속성을 위한 Windows 서비스 생성·변경과 비정상 실행 경로 탐지' },
  { name: 'suspicious_scheduled_task_temp_binary', condition: 'T1053 고수준 경보에서 새롭거나 무작위 이름·시간 외 실행인 예약 작업이 임시 폴더 실행 파일을 가리킬 때', evidence: 'MITRE ATT&CK T1053.005: 악의적 프로그램의 예약 실행을 통한 지속성 확보' },
  { name: 'unlisted_startup_program', condition: '고수준 경보에서 시작 폴더에 평소 목록에 없던 실행 프로그램이 새로 추가되고 실제 Startup 경로가 확인될 때', evidence: 'MITRE ATT&CK T1547.001: 시작 폴더 자동 실행을 이용한 지속성(과제의 서비스 T1543과는 별도 기법)' },
  { name: 'repeated_unsigned_service_registration', condition: 'T1543 고수준 경보에서 서명 없는 서비스가 새로 등록되며 같은 원격 출발지에서 3회 이상 연속 발생할 때', evidence: 'MITRE ATT&CK T1543.003: 새 서비스 등록의 연속 발생과 신뢰할 수 없는 서명은 복합 지속성 신호' },
  { name: 'multiple_persistence_mechanisms', condition: 'T1543·T1053가 함께 붙고 시작 프로그램과 예약 작업이 동일 임시 실행 파일을 함께 가리킬 때', evidence: 'MITRE ATT&CK T1543·T1053 및 T1547.001: 서로 다른 자동 실행 수단이 같은 비정상 파일을 실행하는 복합 신호' },
  { name: 'unlisted_service_survives_reboot', condition: 'T1543 고수준 경보에서 평소 목록 밖의 서비스가 재부팅 후에도 남도록 등록되고 임시 파일을 실행할 때', evidence: 'MITRE ATT&CK T1543.003: 부팅 뒤 자동 시작되는 새 Windows 서비스로 지속성 유지' },
  { name: 'persistence_change_needs_review', condition: 'T1543 또는 T1053 관련 수준 5 이상 경보이지만 서명·실행 경로·반복·평소 목록 밖 여부 등 차단 근거가 충분하지 않을 때', evidence: 'MITRE ATT&CK T1543·T1053: 서비스·예약 작업 이벤트는 정상 운영에서도 발생하므로 불충분한 징후는 알림으로 검토' }
]);

const matches = (text, re) => re.test(text);
const cleanString = (value) => typeof value === 'string' ? value.slice(0, 4096).toLowerCase() : '';

export function decide(alert) {
  const rule = alert && typeof alert === 'object' ? alert.rule : null;
  const data = alert && typeof alert === 'object' ? alert.data : null;
  const desc = cleanString(rule?.description);
  const mitre = Array.isArray(rule?.mitre) ? rule.mitre : [];
  const serviceTag = mitre.some(x => typeof x === 'string' && (x === 'T1543' || x.startsWith('T1543.')));
  const taskTag = mitre.some(x => typeof x === 'string' && (x === 'T1053' || x.startsWith('T1053.')));
  const startupTag = mitre.some(x => typeof x === 'string' && (x === 'T1547' || x.startsWith('T1547.')));
  const level = typeof rule?.level === 'number' || typeof rule?.level === 'string' ? Number(rule.level) : NaN;
  const high = Number.isFinite(level) && level >= 10;
  const review = Number.isFinite(level) && level >= 5;
  const rawPath = data?.path ?? data?.filePath ?? data?.imagePath ?? data?.commandPath;
  const path = cleanString(rawPath);
  const tempBinary = matches(path, /(?:[\\/]appdata[\\/]local[\\/]temp[\\/]|[\\/]windows[\\/]temp[\\/]|(?:^|[\\/])tmp[\\/])[^\r\n]{1,260}\.(?:exe|dll|bat|cmd|ps1)\b/i);
  const startupPath = matches(path, /[\\/]start menu[\\/]programs[\\/]startup[\\/][^\r\n]{1,260}\.(?:exe|lnk|bat|cmd|ps1)\b/i);
  const count = Number(data?.count);
  const repeated = Number.isInteger(count) && count >= 3;

  const service = matches(desc, /서비스|\bservice\b/);
  const task = matches(desc, /예약 작업|스케줄(?:된|러)?\s*작업|\bscheduled\s+task\b|\btask\s+schedul/);
  const startup = matches(desc, /시작 (?:폴더|프로그램|항목)|\bstartup\s*(?:folder|item|program)/);
  const unsigned = matches(desc, /서명\s*없|서명이\s*없|서명되지\s*않|\bunsigned\b|\bnot\s+signed\b/)
    || data?.signed === false || data?.signatureValid === false || cleanString(data?.signatureStatus) === 'unsigned';
  const changed = matches(desc, /새\s*서비스|새로\s*등록|서비스\s*등록|서비스\s*실행\s*파일이\s*바뀌|서비스\s*실행\s*파일\s*변경|\b(?:new|created|registered|modified)\s+service\b|\bservice\s+(?:created|registered|modified)\b/);
  const novel = matches(desc, /처음\s*보는|평소\s*목록에\s*없는|평소\s*목록\s*밖|낯선|무작위|임의\s*문자열|\b(?:new|unknown|unlisted|random|unfamiliar)\b/);
  const taskOdd = novel || matches(desc, /수업\s*시간\s*밖|시간\s*외|\b(?:out.of.hours|unusual\s+hour)/);
  const added = matches(desc, /추가됐|추가되었|등록됐|등록되었|\b(?:added|created|registered)\b/);
  const persistent = matches(desc, /다시\s*켜도\s*남|재부팅\s*후에도|\b(?:survive\s+reboot|persist(?:s|ed)?\s+after\s+reboot)/);
  const sharedBinary = matches(desc, /같은\s*임시\s*파일을\s*함께|동일한\s*(?:임시\s*)?(?:실행\s*)?파일을\s*함께|\bsame\s+temp\s+(?:file|binary)/);
  // Negative evidence prevents elevating benign descriptions solely from a technique label.
  const benign = matches(desc, /서비스\s*등록은\s*없|실행\s*파일은\s*그대로|서명된\s*채|평소\s*시각에\s*그대로|기존\s*(?:예약\s*작업|수업\s*도구\s*서비스)|읽기만|서명은\s*아직\s*모|\b(?:no\s+service\s+registration|signed\s+and\s+unchanged)\b/);

  if (high && !benign) {
    if (serviceTag && taskTag && startup && task && tempBinary && sharedBinary) {
      return { action: 'block', confidence: 0.99, reason: PATTERNS[4].name };
    }
    if (serviceTag && service && unsigned && changed && repeated) {
      return { action: 'block', confidence: 0.97, reason: PATTERNS[3].name };
    }
    if (serviceTag && service && tempBinary && unsigned && changed) {
      return { action: 'block', confidence: 0.98, reason: PATTERNS[0].name };
    }
    if (taskTag && task && tempBinary && taskOdd) {
      return { action: 'block', confidence: 0.96, reason: PATTERNS[1].name };
    }
    if ((serviceTag || startupTag) && startup && added && novel && startupPath) {
      return { action: 'block', confidence: 0.94, reason: PATTERNS[2].name };
    }
    if (serviceTag && service && novel && persistent && tempBinary) {
      return { action: 'block', confidence: 0.97, reason: PATTERNS[5].name };
    }
  }

  // ATT&CK tags are context, not proof. No block if the compound evidence is missing.
  if (review && (serviceTag || taskTag || startupTag)) {
    return { action: 'alert', confidence: 0.6, reason: PATTERNS[6].name };
  }
  return { action: 'record', confidence: 0.1, reason: 'no_persistence_pattern' };
}
