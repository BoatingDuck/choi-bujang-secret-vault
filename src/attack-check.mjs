async function runStage4Checks(config, expectedStep = 4) {
  const app = new URL(config.publicAppUrl);

  const request = (path, options = {}) =>
    fetch(new URL(path, app), {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      ...options
    });

  const results = [];

  async function check(attackId, expected, path, options, valid) {
    const response = await request(path, options);
    const passed = await valid(response);

    results.push({
      attackId,
      expected,
      observed: passed
        ? `차단 확인 (HTTP ${response.status})`
        : `차단 미확인 (HTTP ${response.status})`
    });

    if (!passed) {
      throw new Error(
        `${attackId} 점검 실패: HTTP ${response.status}`
      );
    }
  }

  const isJson401 = async response => {
    if (response.status !== 401) return false;

    try {
      const data = await response.json();
      return typeof data.error === 'string';
    } catch {
      return false;
    }
  };

  await check(
    'unauthenticated_api_read',
    '비로그인 목록 조회는 401 JSON으로 거부',
    '/api/notes',
    {},
    isJson401
  );

  await check(
    'unauthenticated_api_write',
    '비로그인 메모 추가는 401 JSON으로 거부',
    '/api/notes',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '4단계 차단 점검',
        body: '저장되면 안 되는 자료'
      })
    },
    isJson401
  );

  await check(
    'invalid_jwt',
    '유효하지 않은 JWT는 401 JSON으로 거부',
    '/api/notes',
    {
      headers: {
        Authorization: 'Bearer aaa.bbb.ccc'
      }
    },
    isJson401
  );

  await check(
    'static_note_exposure',
    '공개 data.json은 404여야 함',
    '/data.json',
    {},
    async response => response.status === 404
  );

  const identityResponse = await request('/aleph.json');
  const identity = identityResponse.ok
    ? await identityResponse.json().catch(() => null)
    : null;

  const identityPassed =
    identityResponse.status === 200 &&
    identity?.step === expectedStep;

  results.push({
    attackId: 'deployment_identity',
    expected: `${expectedStep}단계 배포 식별 파일 존재`,
    observed: identityPassed
      ? `배포 식별 파일 확인 (step ${expectedStep})`
      : `확인 실패 (HTTP ${identityResponse.status})`
  });

  if (!identityPassed) {
    throw new Error('4단계 배포 식별 파일 확인 실패');
  }

  return results;
}

async function runStage3Checks(config) {
  const app = new URL(config.publicAppUrl);

  if (
    app.protocol !== 'https:' ||
    app.pathname !== '/' ||
    app.username ||
    app.password ||
    app.search ||
    app.hash
  ) {
    throw new Error('실제 HTTPS 배포 주소를 확인해 주세요.');
  }

  const request = (path, options = {}) =>
    fetch(new URL(path, app), {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      ...options
    });

  const results = [];

  async function check(attackId, expected, path, options, validate) {
    const response = await request(path, options);
    const passed = await validate(response);

    results.push({
      attackId,
      expected,
      observed: passed
        ? `차단 확인 (HTTP ${response.status})`
        : `차단 미확인 (HTTP ${response.status})`
    });

    if (!passed) {
      throw new Error(
        `${attackId} 공격 점검 실패: HTTP ${response.status}`
      );
    }
  }

  const isJson401 = async response => {
    if (response.status !== 401) return false;

    try {
      const data = await response.json();
      return typeof data.error === 'string';
    } catch {
      return false;
    }
  };

  await check(
    'unauthenticated_api_read',
    '비로그인 메모 조회는 401 JSON으로 거부',
    '/api/notes',
    {},
    isJson401
  );

  await check(
    'unauthenticated_api_write',
    '비로그인 메모 추가는 401 JSON으로 거부',
    '/api/notes',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '3단계 차단 점검',
        body: '인증되지 않은 요청'
      })
    },
    isJson401
  );

  await check(
    'invalid_jwt',
    '유효하지 않은 JWT는 401 JSON으로 거부',
    '/api/notes',
    {
      headers: {
        Authorization: 'Bearer aaa.bbb.ccc'
      }
    },
    isJson401
  );

  await check(
    'static_note_exposure',
    '공개 data.json에서 메모가 노출되지 않아야 함',
    '/data.json',
    {},
    async response => response.status === 404
  );

  const identityResponse = await request('/aleph.json');
  let identity = null;

  if (identityResponse.ok) {
    try {
      identity = await identityResponse.json();
    } catch {
      identity = null;
    }
  }

  const identityPassed =
    identityResponse.status === 200 &&
    identity?.step === 3;

  results.push({
    attackId: 'deployment_identity',
    expected: '3단계 배포 식별 파일이 존재해야 함',
    observed: identityPassed
      ? '배포 식별 파일 확인 (step 3)'
      : `확인 실패 (HTTP ${identityResponse.status})`
  });

  if (!identityPassed) {
    throw new Error('3단계 배포 식별 파일 확인 실패');
  }

  return results;
}


export async function runAttackChecks(config) {
  if (
    config.step === 4 ||
    config.step === 5 ||
    config.step === 6 ||
    config.step === 7
  ) {
    return runStage4Checks(config, config.step);
  }

  if (config.step === 3) {
    return runStage3Checks(config);
  }

  if (config.step !== 2) {
    throw new Error('지원하지 않는 공격 점검 단계입니다.');
  }

  const app = new URL(config.publicAppUrl);

  if (
    app.protocol !== 'https:' ||
    app.username ||
    app.password ||
    app.search ||
    app.hash ||
    app.pathname !== '/' ||
    app.hostname.endsWith('.example')
  ) {
    throw new Error('실제 HTTPS 배포 주소를 확인해 주세요.');
  }

  const options = () => ({
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(10000)
  });

  const staticResponse = await fetch(
    new URL('/data.json', app),
    options()
  );

  let staticCount = null;

  if (staticResponse.ok) {
    try {
      const data = await staticResponse.json();
      staticCount = Array.isArray(data.notes)
        ? data.notes.length
        : null;
    } catch {
      staticCount = null;
    }
  }

  const staticProtected =
    staticResponse.status === 404 ||
    (staticResponse.ok && staticCount === 0);

  const apiResponse = await fetch(
    new URL('/api/notes', app),
    options()
  );

  let apiCount = null;

  if (apiResponse.ok) {
    try {
      const data = await apiResponse.json();
      apiCount = Array.isArray(data.notes)
        ? data.notes.length
        : null;
    } catch {
      apiCount = null;
    }
  }

  return [
    {
      attackId: 'static_note_exposure',
      expected: '공개 정적 파일에 메모가 없어야 함',
      observed: staticProtected
        ? '정적 파일 노출 차단 확인'
        : `차단 미확인 (HTTP ${staticResponse.status}, 메모 ${staticCount ?? '확인 불가'}건)`
    },
    {
      attackId: 'unauthenticated_api_read',
      expected: '2단계의 공개 API 약점을 관찰',
      observed: apiResponse.ok && apiCount === 4
        ? '비로그인 API에서 가상 메모 4건 조회 가능'
        : `공개 API 조회 미확인 (HTTP ${apiResponse.status}, 메모 ${apiCount ?? '확인 불가'}건)`
    }
  ];
}
