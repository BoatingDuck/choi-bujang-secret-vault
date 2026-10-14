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

// Stage 12 judge sandbox: read-only HTTPS checks only. No POST, secret, or
// policy-recovery import (its timingSafeEqual is outside the sandbox API).
async function runStage12ReadOnlyChecks(config) {
  const app = new URL(config.publicAppUrl);
  if (app.protocol !== 'https:' || app.pathname !== '/' || app.username ||
      app.password || app.search || app.hash || !app.hostname ||
      /(?:^localhost$|\.localhost$|\.local$|\.internal$|\.example$)/i.test(app.hostname)) {
    throw new Error('12단계 공개 HTTPS 배포 주소를 확인해 주세요.');
  }

  const results = [];
  const request = path => fetch(new URL(path, app), {
    method: 'GET', cache: 'no-store', redirect: 'error'
  });
  const check = async (attackId, expected, path, valid) => {
    const response = await request(path);
    const passed = await valid(response);
    if (!passed) throw new Error(attackId + ' 확인 실패: HTTP ' + response.status);
    results.push({ attackId, expected, observed: '실제 GET HTTP ' + response.status });
  };
  const json401 = async response => {
    if (response.status !== 401) return false;
    const data = await response.json().catch(() => null);
    return typeof data?.error === 'string';
  };

  await check('unauthenticated_api_read', '비로그인 목록 GET 401', '/api/notes', json401);
  results.push({ attackId: 'unauthenticated_api_write',
    expected: '비로그인 메모 POST 401', observed: 'not_run' });

  // GET with an invalid static token. This is a dummy, never a real credential.
  const invalid = await fetch(new URL('/api/notes', app), {
    method: 'GET', cache: 'no-store', redirect: 'error',
    headers: { Authorization: 'Bearer aaa.bbb.ccc' }
  });
  if (!await json401(invalid)) throw new Error('invalid_jwt 확인 실패: HTTP ' + invalid.status);
  results.push({ attackId: 'invalid_jwt', expected: '잘못된 JWT GET 401',
    observed: '실제 GET HTTP ' + invalid.status });

  await check('static_note_exposure', '공개 data.json GET 404', '/data.json',
    response => response.status === 404);

  const deployed = await request('/aleph.json');
  const deployedId = deployed.status === 200 ? await deployed.json().catch(() => null) : null;
  if (deployedId?.step !== 12) throw new Error('12단계 배포 식별 파일 검증 실패');
  results.push({ attackId: 'deployment_identity',
    expected: '배포 식별 파일 12단계', observed: '실제 GET HTTP 200, step 12' });

  // This is an explicitly labelled local virtual fixture, NOT engine revocation.
  const { detect } = await import('./detect.mjs');
  const start = Date.UTC(2026, 9, 1);
  const events = n => Array.from({ length: n }, (_, i) => ({
    method: 'GET', at: new Date(start + i * 2000).toISOString(),
    identity: { sub: 'learner_fixture' }
  }));
  const normal = detect(events(120));
  const burst = detect(events(121));
  if (normal?.action !== 'observe' || burst?.action !== 'propose_revocation' ||
      burst?.reasonCode !== 'burst_read' || burst?.subject !== 'learner_fixture') {
    throw new Error('12단계 가상 탐지 검사 실패');
  }
  results.push({ attackId: 'normal_read_preserved',
    expected: '가상 조회 120건 observe', observed: '로컬 가상 검사: observe' });
  results.push({ attackId: 'burst_read_revocation',
    expected: '가상 조회 121건 회수 제안', observed: '로컬 가상 검사: propose_revocation (실제 회수 아님)' });

  // Judge sandbox permits public GET/HEAD only; NEVER send write requests.
  results.push({ attackId: 'restore_unauthenticated_denied',
    expected: '비로그인 복원 POST 401', observed: 'not_run' });
  // The local policy recovery module requires timingSafeEqual, unsupported here.
  results.push({ attackId: 'test_policy_recovery',
    expected: '시험 정책 사본 검증과 복원', observed: 'not_run' });
  return results;
}

export async function runAttackChecks(config) {
  if (config.step === 12) return runStage12ReadOnlyChecks(config);
  if (config.step === 9 || config.step === 10 || config.step === 11) {
    const results = await runStage4Checks(config, config.step);
    const { detect } = await import('./detect.mjs');
    const start = Date.UTC(2026, 9, 1);
    const reads = count => Array.from({ length: count }, (_, i) => ({
      at: new Date(start + i * 2000).toISOString(),
      method: 'GET',
      identity: { sub: 'learner_fixture' }
    }));

    const normal = await detect(reads(120));
    const suspicious = await detect(reads(121));

    if (normal?.action !== 'observe') {
      throw new Error('9단계 정상 조회 탐지 점검 실패');
    }
    if (suspicious?.action !== 'propose_revocation' ||
      suspicious.reasonCode !== 'burst_read' ||
      suspicious.subject !== 'learner_fixture') {
      throw new Error('9단계 폭주 조회 회수 제안 점검 실패');
    }

    results.push({
      attackId: 'normal_read_preserved',
      expected: '120건 조회는 회수 제안 없음',
      observed: '로컬 탐지 점검 통과: observe'
    });
    results.push({
      attackId: 'burst_read_revocation',
      expected: '121건 조회는 해당 가상 사용자 회수 제안',
      observed: '로컬 탐지 점검 통과: propose_revocation'
    });
    if (config.step === 10 || config.step === 11 || config.step === 12) {
      const restoreUnauthenticated = await fetch(new URL(config.restoreRoute, config.publicAppUrl), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', confirm: true }),
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000)
      });
      if (restoreUnauthenticated.status !== 401) {
        throw new Error(`鍮꾨줈洹몄씤 蹂듭썝 嫄곕? 誘명솗?? HTTP ${restoreUnauthenticated.status}`);
      }
      results.push({ attackId: 'restore_unauthenticated_denied',
        expected: '鍮꾨줈洹몄씤 蹂듭썝 POST??401',
        observed: `?ㅼ젣 諛고룷 ?붿껌 寃곌낵 HTTP ${restoreUnauthenticated.status}` });
      const { SAFE_POLICY, policyDigest, comparePolicy, restoreTestPolicy } = await import('./policy-recovery.mjs');
      const backup = { ...SAFE_POLICY };
      const current = { ...backup, select: 'true', anotherService: 'unchanged' };
      const digest = policyDigest(backup);
      const comparison = comparePolicy(backup, current, digest);
      const preview = restoreTestPolicy(backup, current, digest, false);
      const restored = restoreTestPolicy(backup, current, digest, true);
      if (!comparison.changes.includes('select') || preview.applied ||
          restored.policy.select !== backup.select || restored.policy.anotherService !== 'unchanged') {
        throw new Error('10단계 시험 정책 복원 로컬 점검 실패');
      }
      results.push({
        attackId: 'test_policy_recovery',
        expected: '가상 정책 사본 검증 후 다른 서비스 설정 보존',
        observed: '로컬 시험 통과 (운영 정책 미변경)'
      });
    }
    return results;
  }

  if (
    config.step === 4 ||
    config.step === 5 ||
    config.step === 6 ||
    config.step === 7 ||
    config.step === 8
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
