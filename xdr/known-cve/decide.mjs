// This file is deliberately self-contained for the offline judge: NO imports or I/O.
// Keep these records synchronized with patterns.json.
const PATTERNS = Object.freeze([
  {
    name: 'log4shell_remote_jndi_lookup',
    condition: 'HTTP 머리글·User-Agent·URL·요청 인자에 ${jndi:<원격 프로토콜>://...} 완성 구문이 있을 때만 명확한 악용 요청으로 판단',
    evidence: 'CVE-2021-44228(NIST NVD): Log4j 메시지의 외부 JNDI LDAP 등 조회를 통한 코드 실행 위험; MITRE ATT&CK T1190'
  },
  {
    name: 'incomplete_jndi_lookup',
    condition: '요청 데이터에 ${jndi: 로 시작하지만 원격 대상까지 완성되지 않은 구문이 있을 때 차단 대신 경보',
    evidence: 'CVE-2021-44228의 JNDI 조회 문법과 유사하지만 불완전한 문자열은 원격 악용의 확실한 증거가 아님'
  },
  {
    name: 'cve_probe_or_reference',
    condition: 'T1190 경보에 CVE-2021-44228·Log4j·JNDI·취약점 점검 도구·조회 구문 조각 등의 정황만 있을 때 알림',
    evidence: 'MITRE ATT&CK T1190은 공개 애플리케이션 악용 기법이며 단어·점검 흔적만으로 성공한 공격을 입증하지 못함'
  },
  {
    name: 't1190_weak_signal_review',
    condition: 'Wazuh 경보가 T1190으로 분류되고 수준 5 이상이지만 완성된 JNDI 악용 문자열이 없으면 검토 알림만 남김',
    evidence: 'MITRE ATT&CK T1190은 분류 태그이므로 취약점 악용 요청을 확인하지 않고 IP 거부 규칙을 만들 근거가 아님'
  }
]);

// Only inspect HTTP request fields, NOT rule descriptions, rule IDs, source
// addresses or usernames. Educational text that merely mentions a CVE is not
// a confirmed attempt. Limit input size and recursion for untrusted alerts.
const SKIP_FIELDS = /^(?:srcip|srcuser|dstip|dstuser|username|user|ip|account|session|timestamp|id|count|level|rule|mitre)$/i;
const REMOTE_JNDI = /\$\{\s*jndi\s*:\s*(?:ldap|ldaps|rmi|dns|iiop|nis|corba)\s*:\/\/[^\s{}<>"'\\]{1,256}\s*\}/i;
const START_JNDI = /\$\{\s*jndi\s*:/i;
const PROBE_WORDS = /\b(?:CVE[-_ ]?2021[-_ ]?44228|log4j|jndi|log4shell|lookup[-_ ]?fragment|vuln(?:erability)?[-_ ]?scan|cve[-_ ]?list)\b/i;

function requestTexts(data) {
  const texts = [];
  const seen = new Set();
  function visit(value, depth) {
    if (depth > 4 || texts.length >= 64 || value == null) return;
    if (typeof value === 'string') {
      const text = value.slice(0, 8192);
      texts.push(text);
      // URL decoding is defensive normalization; malformed percent escapes are ignored.
      let decoded = text;
      for (let pass = 0; pass < 2; pass += 1) {
        try {
          const next = decodeURIComponent(decoded);
          if (next === decoded) break;
          decoded = next;
          texts.push(decoded.slice(0, 8192));
        } catch {
          break;
        }
      }
      return;
    }
    if (typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 24)) visit(item, depth + 1);
    } else {
      for (const [key, item] of Object.entries(value).slice(0, 48)) {
        if (!SKIP_FIELDS.test(key)) visit(item, depth + 1);
      }
    }
  }
  visit(data, 0);
  return texts;
}

export function decide(alert) {
  const level = Number(alert?.rule?.level);
  const mitre = Array.isArray(alert?.rule?.mitre) && alert.rule.mitre.includes('T1190');
  const description = typeof alert?.rule?.description === 'string' ? alert.rule.description : '';
  const texts = requestTexts(alert?.data);

  // A remote JNDI lookup inside the actual request is the decisive signal.
  if (texts.some(value => REMOTE_JNDI.test(value))) {
    return { action: 'block', confidence: 0.98, reason: PATTERNS[0].name };
  }
  if (texts.some(value => START_JNDI.test(value))) {
    return { action: 'alert', confidence: 0.72, reason: PATTERNS[1].name };
  }

  // A CVE reference, a scanner-like trace, or a technique label alone
  // warrants review, never an automatic deny proposal.
  if (mitre && Number.isFinite(level) && level >= 5) {
    const context = [description, ...texts].join(' ').slice(0, 32768);
    if (PROBE_WORDS.test(context) || /취약점|원격 조회|잘린 글자|점검 도구|중괄호|로그 라이브러리/.test(description)) {
      return { action: 'alert', confidence: 0.62, reason: PATTERNS[2].name };
    }
    return { action: 'alert', confidence: 0.53, reason: PATTERNS[3].name };
  }
  return { action: 'record', confidence: 0.1, reason: 'no_known_cve_pattern' };
}
