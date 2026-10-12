// Standalone decision module: no imports, file access, or side effects.
// Mirrors xdr/web-injection/patterns.json at the top of this file.
const PATTERNS = Object.freeze([
  { name: 'repeated_sql_injection', minCount: 8, evidence: 'T1190: repeated SQL injection expressions' },
  { name: 'repeated_script_injection', minCount: 8, evidence: 'T1190: repeated script insertion markers' },
  { name: 'repeated_path_traversal', minCount: 8, evidence: 'T1190: repeated parent-directory traversal markers' },
  { name: 'repeated_command_separator', minCount: 8, evidence: 'T1190: repeated command separators in web requests' },
  { name: 'isolated_suspicious_marker', minCount: 1, evidence: 'T1190: weak isolated suspicion, review instead of blocking' },
]);

export function decide(alert) {
  const description = typeof alert?.rule?.description === 'string' ? alert.rule.description.toLowerCase() : '';
  const url = typeof alert?.data?.url === 'string' ? alert.data.url.toLowerCase() : '';
  const count = Number(alert?.data?.count);
  const level = Number(alert?.rule?.level);
  const mitre = Array.isArray(alert?.rule?.mitre) && alert.rule.mitre.includes('T1190');
  const repeats = Number.isFinite(count) && count >= 8;

  // Do not classify benign class names, singular punctuation, or low-signal T1190 labels as attacks.
  const sql = /sql 구문|sql 표식|데이터베이스 조회를 이어|sql injection|union\s+select|(?:or|and)\s+['"\d]+\s*=/.test(description) || /(?:union(?:%20|\+|\s)+select|%27(?:%20|\+)*(?:or|and)|'\s*(?:or|and)\s)/.test(url);
  const script = /스크립트 삽입|스크립트 표식|script insertion|script tag/.test(description) || /(?:<script\b|%3cscript\b)/.test(url);
  const traversal = /경로를 여러 단계 거슬러|경로 이탈 표기|상위 경로 반복|path traversal/.test(description) || /(?:\.\.\/|%2e%2e%2f|%252e%252e%252f)/.test(url);
  const command = /명령 구분자 표기|command separator/.test(description) || /(?:%3b|;)(?:cat|id|whoami|wget|curl)(?:\b|%20)/.test(url);

  if (mitre && repeats && level >= 9) {
    if (sql) return { action: 'block', confidence: 0.96, reason: PATTERNS[0].name };
    if (script) return { action: 'block', confidence: 0.96, reason: PATTERNS[1].name };
    if (traversal) return { action: 'block', confidence: 0.95, reason: PATTERNS[2].name };
    if (command) return { action: 'block', confidence: 0.94, reason: PATTERNS[3].name };
  }

  if (mitre && level >= 5 && (description.includes('검색어') || description.includes('요청') || description.includes('표기') || description.includes('경로') || description.includes('sql') || description.includes('스크립트') || description.includes('이상한') || description.includes('구분') || description.includes('주소'))) {
    return { action: 'alert', confidence: 0.58, reason: PATTERNS[4].name };
  }
  return { action: 'record', confidence: 0.1, reason: 'no_injection_pattern' };
}
