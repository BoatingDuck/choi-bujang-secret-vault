// Stage 12 integration evidence: browser-observed HTTP statuses only.
// Never saves credentials, note responses, device keys or request bodies.
export const EVIDENCE_SCHEMA = 'byteback.evidence.v1';
export const CHECK_CASES = Object.freeze([
  { id: 'S01_STATIC', step: 1, label: '공개 자료 파일 비노출', expected: 404, mode: 'anonymous', path: '/data.json' },
  { id: 'S02_DIRECT_DB', step: 2, label: '원본 DB 직접 접근 권한', expected: 'DENY', mode: 'skip', reason: '원본 DB 직접 조회는 이 브라우저 검사에서 수행하지 않음' },
  { id: 'S03_SESSION', step: 3, label: '로그인 세션 조회', expected: 200, mode: 'session', path: '/api/auth/session' },
  { id: 'S03_BAD_TOKEN', step: 3, label: '잘못된 토큰 조회 거부', expected: 401, mode: 'invalid_token', path: '/api/notes' },
  { id: 'S04_ANONYMOUS', step: 4, label: '무인증 메모 목록 거부', expected: 401, mode: 'anonymous', path: '/api/notes' },
  { id: 'S05_OWNER_READ', step: 5, label: '승인 기기 본인 목록 허용', expected: 200, mode: 'signed', path: '/api/notes' },
  { id: 'S06_UNSIGNED', step: 6, label: '서명 없는 로그인 기기 거부', expected: 403, mode: 'unsigned', path: '/api/notes' },
  { id: 'S07_STEP_UP', step: 7, label: '실제 이상 접속 추가 확인', expected: 'step_up', mode: 'skip', reason: '운영 SDP 엔진의 이상 접속 실행 근거 없음 (로컬 가상 검사와 구별)' },
  { id: 'S08_ZONE', step: 8, label: '실제 SDP 구역 밖 요청 거부', expected: 'deny', mode: 'skip', reason: '운영 SDP 엔진의 해당 경로 판정 근거 없음' },
  { id: 'S09_REVOCATION', step: 9, label: '접속 회수 반영', expected: 'revoked', mode: 'skip', reason: '회수 요청/상태의 실제 운영 엔진 증거 없음' },
  { id: 'S10_ANON_RESTORE', step: 10, label: '무인증 복원 요청 거부', expected: 401, mode: 'unauth_restore', path: '/api/restore-note' },
  { id: 'S10_REAL_RESTORE', step: 10, label: '실제 사본 적용 및 사후 조회', expected: 'verified', mode: 'skip', reason: '파괴적 복원을 자동 실행하지 않음; 별도 복구 시험 기록 필요' },
  { id: 'S11_SIGNED_OPS', step: 11, label: '서명된 작전실 조회 허용', expected: 200, mode: 'signed', path: '/api/ops/status' },
  { id: 'S11_PATH_TAMPER', step: 11, label: '서명 뒤 경로 변조 차단', expected: 403, mode: 'tamper_path', path: '/api/notes?export=1' },
  { id: 'S11_BODY_TAMPER', step: 11, label: '서명 뒤 본문 변조 차단 (무효 본문)', expected: 403, mode: 'tamper_body', path: '/api/notes' },
  { id: 'S11_NONCE_FIRST', step: 11, label: '최초 서명 요청 허용', expected: 200, mode: 'replay_first', path: '/api/notes' },
  { id: 'S11_NONCE_REPLAY', step: 11, label: '동일 서명 재전송 거부', expected: 403, mode: 'replay_second', path: '/api/notes' }
]);

const UNKNOWN = 'NOT_RUN';
const toSafeTime = time => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(time ?? '') ? time : null;

export async function runSafeEvidenceChecks({
  fetchImpl, signedHeaders, newId, now, active = () => true, onRow = () => {}
}) {
  if (typeof fetchImpl !== 'function' || typeof signedHeaders !== 'function' ||
      typeof newId !== 'function' || typeof now !== 'function') throw new Error('invalid_evidence_dependencies');
  const rows = [];
  let replayHeaders = null;
  let firstSucceeded = false;
  for (const item of CHECK_CASES) {
    if (!active()) break;
    let row = {
      caseId: item.id, step: item.step, scenario: item.label,
      expected: item.expected, observedHttp: null, requestId: null,
      checkedAt: null, result: UNKNOWN, detail: item.reason ?? ''
    };
    if (item.mode === 'skip' || (item.mode === 'replay_second' && !firstSucceeded)) {
      if (item.mode === 'replay_second') row.detail = '최초 정상 서명 요청 미확인';
      rows.push(row); onRow(row); continue;
    }
    row.requestId = newId(); // Local correlation ID; not a verified server trace ID.
    try {
      const options = { method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error' };
      if (item.mode === 'session' || item.mode === 'unsigned') options.credentials = 'same-origin';
      if (item.mode === 'invalid_token') options.headers = { Authorization: 'Bearer invalid' };
      if (item.mode === 'signed' || item.mode === 'replay_first') {
        options.credentials = 'same-origin';
        options.headers = await signedHeaders(item.path, { method: 'GET' });
        if (item.mode === 'replay_first') replayHeaders = { ...options.headers };
      }
      if (item.mode === 'replay_second') {
        options.credentials = 'same-origin';
        options.headers = { ...replayHeaders };
      }
      if (item.mode === 'tamper_path') {
        options.credentials = 'same-origin';
        options.headers = await signedHeaders('/api/notes', { method: 'GET' });
      }
      if (item.mode === 'tamper_body') {
        options.credentials = 'same-origin';
        options.method = 'POST';
        options.headers = {
          'Content-Type': 'application/json',
          ...await signedHeaders(item.path, { method: 'POST', body: '{"title":"","body":""}' })
        };
        // Deliberately invalid both before and after alteration: never creates a note.
        options.body = '{"title":"","body":"changed"}';
      }
      if (item.mode === 'unauth_restore') {
        options.method = 'POST';
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', confirm: false });
      }
      const response = await fetchImpl(item.path, options);
      row.observedHttp = response.status;
      row.checkedAt = toSafeTime(now());
      row.result = response.status === item.expected ? 'MATCH' : 'MISMATCH';
      // No response bodies are read or displayed, including successful note responses.
      if (item.mode === 'replay_first') firstSucceeded = row.result === 'MATCH';
    } catch {
      row.checkedAt = toSafeTime(now());
      row.result = 'UNAVAILABLE';
      row.detail = '네트워크·서명·요청 오류 (HTTP 응답을 받지 못함)';
    }
    rows.push(row); onRow(row);
  }
  return {
    schema: EVIDENCE_SCHEMA,
    checkedCommit: null, // Verified deployed commit is recorded separately by server ops summary.
    requestIdKind: 'CLIENT_GENERATED_ONLY',
    evidenceSource: 'BROWSER_HTTP_RESPONSE',
    exportedAt: toSafeTime(now()),
    assault41: { total: 41, status: UNKNOWN, verified: null },
    rows,
    counts: {
      match: rows.filter(row => row.result === 'MATCH').length,
      mismatch: rows.filter(row => row.result === 'MISMATCH').length,
      unavailable: rows.filter(row => row.result === 'UNAVAILABLE').length,
      notRun: rows.filter(row => row.result === UNKNOWN).length
    }
  };
}
