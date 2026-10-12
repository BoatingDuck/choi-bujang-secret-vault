// Offline, side-effect-free judge module. Keep synchronized with patterns.json.
const PATTERNS = Object.freeze([
  { name: 'rapid_failure_burst', condition: '한 출발지/계정에서 3분 이내 로그인 실패 30건 이상', evidence: 'MITRE ATT&CK T1110: 짧은 시간 반복 인증 시도는 무차별 대입의 지표다.' },
  { name: 'password_spraying', condition: '동일 출발지에서 여러 계정에 같은 비밀번호를 연속 시도하거나 10개 이상의 계정을 순회', evidence: 'MITRE ATT&CK T1110.003: 한 개 또는 소수 비밀번호를 다수 계정에 적용한다.' },
  { name: 'password_guessing', condition: '비밀번호를 조금씩 바꾸는 반복 실패 30건 이상', evidence: 'MITRE ATT&CK T1110.001: 후보 비밀번호를 순차적으로 추측한다.' },
  { name: 'suspicious_failure', condition: '인증 실패가 반복되지만 차단할 만큼 강한 정황은 없는 경우', evidence: 'MITRE ATT&CK T1110: 낮은 빈도의 실패만으로 공격 여부를 확정할 수 없다.' }
]);

export function decide(alert) {
  const desc = typeof alert?.rule?.description === 'string' ? alert.rule.description : '';
  const level = Number(alert?.rule?.level ?? 0);
  const count = Number(alert?.data?.count ?? 0);
  const mitre = Array.isArray(alert?.rule?.mitre) && alert.rule.mitre.some(t => t === 'T1110' || String(t).startsWith('T1110.'));
  const source = typeof alert?.data?.srcip === 'string' && alert.data.srcip.length > 0;
  const isFailure = /실패/.test(desc);
  const success = /성공|로그아웃|유지|열렸|확인했/.test(desc.replace(/성공은 없습니다/g, '')); 
  const rapid = /([123])분\s*(?:안|동안|이내)|연속|이어졌|쌓였|같은 주소와 같은 계정/.test(desc);
  const multi = /여러 계정|계정\s*\d+개|서로 다른 계정/.test(desc);
  const spray = /같은 비밀번호/.test(desc) && multi;
  const guessing = /비밀번호를 한 글자씩 바꿔/.test(desc);
  const strongBurst = isFailure && count >= 30 && (rapid || guessing || /성공은 없습니다/.test(desc));
  const strongSpray = spray && (count >= 10 || /user\d+,user\d+/.test(String(alert?.data?.accounts ?? '')));
  const accountSweep = multi && count >= 15 && level >= 10;
  let confidence = 0.1;
  let pattern = 'none';
  if ((isFailure || spray) && !success && mitre && source) {
    if (strongSpray || accountSweep) { confidence = 0.96; pattern = PATTERNS[1].name; }
    else if (guessing && count >= 30) { confidence = 0.94; pattern = PATTERNS[2].name; }
    else if (strongBurst && level >= 10) { confidence = 0.95; pattern = PATTERNS[0].name; }
    else { confidence = 0.62; pattern = PATTERNS[3].name; }
  } else if (isFailure && mitre && source) {
    confidence = 0.53;
    pattern = PATTERNS[3].name;
  }
  const action = confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record';
  return { action, confidence, reason: pattern };
}
