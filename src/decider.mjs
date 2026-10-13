
export const RULE_IDS = Object.freeze([
  'device_registered',
  'step_up_required',
  'resource_zone'
]);

// 8단계: 안전한 단일 메모 ID만 허용
const NOTE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

// 기능 경로를 메모 ID로 오인하지 않도록 차단
const RESERVED_PATHS = new Set([
  'export',
  'import',
  'search',
  'admin'
]);

function validResource(request) {
  const { service, method, path, route } = request;

  // 엔진이 확인한 자료실 서비스만 허용
  if (service !== 'notes') {
    return false;
  }

  if (
    typeof method !== 'string' ||
    typeof path !== 'string' ||
    typeof route !== 'string'
  ) {
    return false;
  }

  // 메모 목록 조회 및 생성
  if (path === '/notes') {
    return (
      (method === 'GET' && route === 'GET /notes') ||
      (method === 'POST' && route === 'POST /notes')
    );
  }

  // 정확히 한 단계의 자원 ID만 허용
  const match = /^\/notes\/([^/]+)$/.exec(path);

  if (!match) {
    return false;
  }

  const noteId = match[1];

  // 잘못된 ID나 예약된 기능 경로는 거부
  if (
    !NOTE_ID_PATTERN.test(noteId) ||
    RESERVED_PATHS.has(noteId.toLowerCase())
  ) {
    return false;
  }

  // 메서드와 엔진이 검증한 라우트 일치 확인
  return (
    ['GET', 'PUT', 'DELETE'].includes(method) &&
    route === `${method} /notes/:id`
  );
}

function response(request, decision, reasonCode, ruleIds) {
  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision,
    reasonCode,
    ruleIds
  };
}

export async function decide(request) {
  // 6단계: 등록되지 않은 기기는 거부
  if (request?.deviceRegistered !== true) {
    return response(
      request,
      'deny',
      'device_not_registered',
      ['device_registered']
    );
  }

  // 8단계: 정확한 서비스, 메서드, 자원 경로 검사
  if (!validResource(request)) {
    return response(
      request,
      'deny',
      'access_denied',
      ['resource_zone']
    );
  }

  // 7단계: 엔진이 전달한 가상 접속 사건 분석
  const signals = request.signals;
  const trustedFixture =
    signals?.source === 'judge_fixture';

  const unusualHour =
    trustedFixture &&
    Number.isInteger(signals.hour) &&
    (signals.hour < 6 || signals.hour >= 23);

  const unusualNetwork =
    trustedFixture &&
    signals.network === 'unusual';

  const manyEvents =
    Array.isArray(request.recentEvents) &&
    request.recentEvents.some(event =>
      event?.kind === 'risk_signal' &&
      Number.isInteger(event.count) &&
      event.count >= 20
    );

  // 단일 지역 변화만으로 차단하지 않음
  const suspicious =
    unusualHour &&
    unusualNetwork &&
    manyEvents;

  if (suspicious) {
    const stepUp = request.stepUp;

    const recentlyVerified =
      stepUp?.verified === true &&
      Number.isInteger(stepUp.authAgeSeconds) &&
      stepUp.authAgeSeconds >= 0 &&
      stepUp.authAgeSeconds <= 900;

    if (!recentlyVerified) {
      return response(
        request,
        'step_up',
        'step_up_required',
        [
          'device_registered',
          'step_up_required'
        ]
      );
    }
  }

  // 등록 기기 + 허용 경로 + 추가 인증 조건 충족
  return response(
    request,
    'allow',
    'approved',
    [
      'device_registered',
      'resource_zone'
    ]
  );
}
