// XDR-05 independent classifier. No imports, file access, network access or side effects.
// PATTERNS is a literal copy of patterns.json, kept at the top for the offline judge.
const PATTERNS = Object.freeze([
  {
    "name": "unexpected_remote_admin_membership",
    "condition": "T1078 고수준 경보: 원격 주소에서 계정이 administrators 그룹에 새로 추가된 사건이 확인될 때",
    "evidence": "MITRE ATT&CK T1078(Valid Accounts): 변경된 고권한 계정을 공격자가 악용할 수 있어 원격 관리자 그룹 추가를 복합 신호로 검토"
  },
  {
    "name": "newly_elevated_admin_command",
    "condition": "T1068 또는 T1078 고수준 경보: 방금 관리자 권한을 얻은 계정이 즉시 관리자 명령을 실행할 때",
    "evidence": "MITRE ATT&CK T1078: 새로 얻은 높은 계정 권한의 즉각적인 사용은 계정 악용 정황; T1068 태그 자체는 취약점 악용 입증이 아님"
  },
  {
    "name": "offhours_unfamiliar_admin_command",
    "condition": "T1068 고수준 경보: 업무·수업 시간 밖에 처음 보는 출발 주소에서 관리자 명령을 실행할 때",
    "evidence": "MITRE ATT&CK T1078 탐지 전략: 계정 사용의 비정상 시각·원격 주소와 관리자 권한 명령의 결합은 이상 징후"
  },
  {
    "name": "admin_membership_and_command_chain",
    "condition": "T1078 고수준 경보: 평범한 계정의 관리자 그룹 추가 직후 명령 실행 또는 시간 외 그룹 추가와 권한 명령이 함께 확인될 때",
    "evidence": "MITRE ATT&CK T1078: 계정 권한 변경과 높은 권한을 실제 사용하는 행위의 연쇄는 악용 정황 강화"
  },
  {
    "name": "multiple_admin_membership_additions",
    "condition": "T1078 고수준 경보: 동일 주소에서 3건 이상의 계정이 administrators 그룹에 추가된 것으로 확인될 때",
    "evidence": "MITRE ATT&CK T1078: 여러 유효 계정의 높은 권한 추가가 집중되는 이상 변화는 계정 악용 위험 신호"
  },
  {
    "name": "unexpected_admin_session_elevation",
    "condition": "T1068 고수준 경보: 계정 세션 권한이 관리자로 바뀌었고 요청 주소도 처음 보는 곳일 때",
    "evidence": "MITRE ATT&CK T1068: 비정상 권한 상승 후 세션 변화 탐지; 실제 취약점 악용 여부는 이 경보만으로 확정하지 않음"
  },
  {
    "name": "cross_account_privileged_command",
    "condition": "T1068 고수준 경보: 기존 사용자가 다른 계정 권한을 사용해 관리자 명령을 실행할 때",
    "evidence": "MITRE ATT&CK T1078: 다른 유효 계정의 관리자 권한 이용은 계정 악용 가능성이 높은 정황"
  },
  {
    "name": "rapid_admin_membership_readdition",
    "condition": "T1078 고수준 경보: 관리자 그룹에서 빠진 계정이 1분 이내 다시 관리자 그룹에 들어온 사건이 확인될 때",
    "evidence": "MITRE ATT&CK T1078: 짧은 시간 내 고권한 그룹 멤버십 회복은 의심스러운 권한 유지·재획득 정황"
  },
  {
    "name": "privilege_change_needs_review",
    "condition": "T1068 또는 T1078이 붙은 규칙 수준 5 이상 경보이지만 원격성·그룹 변경·명령 실행의 복합 근거가 충분하지 않을 때 알림만 남김",
    "evidence": "MITRE ATT&CK T1068·T1078: 단일 관리자 명령, 승인된 수업 작업, 실패·취소 이벤트, 기법 태그만으로 악용을 단정할 수 없음"
  }
]);

const lower = value => typeof value === 'string' ? value.slice(0, 4096).toLowerCase() : '';
const technique = (mitre, id) => Array.isArray(mitre) && mitre.some(value =>
  typeof value === 'string' && (value === id || value.startsWith(id + '.')));
const result = (confidence, reason) => ({
  action: confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record',
  confidence, reason
});

export function decide(alert) {
  const rule = alert && typeof alert === 'object' ? alert.rule : null;
  const data = alert && typeof alert === 'object' ? alert.data : null;
  const level = Number(rule?.level);
  const desc = lower(rule?.description);
  const mitre = rule?.mitre;
  const t1068 = technique(mitre, 'T1068');
  const t1078 = technique(mitre, 'T1078');
  const group = lower(data?.group);
  const targetAdminGroup = /^(administrators|administrators group|builtin\\administrators|관리자|관리자 그룹)$/.test(group);
  const account = lower(data?.srcuser);
  const hasAccount = account.length >= 2 && account.length <= 128;
  const source = lower(data?.srcip);
  const validIp = source.split('.').length === 4 && source.split('.').every(o => /^\d{1,3}$/.test(o) && Number(o) <= 255);
  const count = Number(data?.count);
  const high = Number.isFinite(level) && level >= 10;
  const review = Number.isFinite(level) && level >= 5;

  const adminGroupAddition = /관리자\s*그룹(?:에|으로)?\s*(?:추가|들어가|등록)|관리자\s*그룹\s*추가|(?:added|joined)\s+(?:to\s+)?administrators/.test(desc);
  const adminCommand = /(?:관리자|권한)\s*명령/.test(desc) && /실행|사용|executed|ran/.test(desc);
  const commandWithAdminGroup = adminCommand || (t1068 && t1078 && targetAdminGroup && /명령\s*실행/.test(desc));
  const unfamiliar = /처음\s*보는\s*(?:주소|접속)|낯선\s*(?:주소|원격)|원격\s*주소|주소(?:는|가)\s*처음\s*(?:봅|보)|unfamiliar\s+(?:address|ip)|new\s+remote/.test(desc);
  const offHours = /수업\s*시간\s*밖|업무(?:\s*시간)?\s*밖|업무처럼\s*보이지\s*않는\s*시각|근무\s*시간\s*외|outside\s+(?:working|class)\s+hours|off.hours/.test(desc);
  const recentlyElevated = /방금\s*관리자가\s*된|관리자가\s*된\s*직후|just\s+elevated/.test(desc);
  const ordinary = /평범한\s*계정|일반\s*계정/.test(desc);
  const immediate = /곧바로|직후|함께|동시에|immediately/.test(desc);
  const sessionElevated = /세션이\s*관리자\s*권한으로\s*바뀌|session\s+(?:was\s+)?elevated\s+to\s+admin/.test(desc);
  const borrowedIdentity = /다른\s*계정의\s*권한으로|another\s+account.s\s+privileges/.test(desc);
  const repeatedAdd = /관리자\s*그룹(?:에|으로)?\s*추가|관리자\s*그룹에\s*추가/.test(desc);
  const rapidReadd = /관리자\s*그룹에서\s*빠진|관리자\s*그룹에서\s*제거/.test(desc)
    && /다시\s*관리자로\s*들어왔|다시\s*관리자\s*그룹/.test(desc)
    && /1분\s*뒤|1분\s*이내|짧은\s*시간\s*뒤|within\s+one\s+minute/.test(desc);

  // A failed/cancelled/non-administrator/unchanged/known benign event may not be blocked.
  const weakOrBenign = /취소됐|실패(?:했|\s*1건|로\s*끝)|변경은\s*없|명령은\s*없|관리자\s*그룹은\s*아닙니다|평소\s*주소|과제\s*그룹|수업\s*그룹|읽기만|로그인했|로그아웃했|(?:cancelled|failed|unchanged|not\s+admin)/.test(desc);

  if (high && hasAccount && validIp && !weakOrBenign) {
    if (t1078 && rapidReadd && targetAdminGroup) {
      return result(0.96, PATTERNS[7].name);
    }
    if (t1078 && targetAdminGroup && repeatedAdd && Number.isInteger(count) && count >= 3) {
      return result(0.97, PATTERNS[4].name);
    }
    if (t1078 && targetAdminGroup && adminGroupAddition && unfamiliar) {
      return result(0.97, PATTERNS[0].name);
    }
    if ((t1068 || t1078) && recentlyElevated && adminCommand) {
      return result(0.97, PATTERNS[1].name);
    }
    if (t1078 && targetAdminGroup && adminGroupAddition &&
      ((ordinary && immediate && commandWithAdminGroup) || (offHours && commandWithAdminGroup))) {
      return result(0.98, PATTERNS[3].name);
    }
    if (t1068 && adminCommand && offHours && unfamiliar) {
      return result(0.96, PATTERNS[2].name);
    }
    if (t1068 && sessionElevated && unfamiliar) {
      return result(0.95, PATTERNS[5].name);
    }
    if (t1068 && borrowedIdentity && adminCommand) {
      return result(0.96, PATTERNS[6].name);
    }
  }
  if (review && (t1068 || t1078)) {
    return result(0.6, PATTERNS[8].name);
  }
  return result(0.1, 'no_privilege_abuse_pattern');
}
