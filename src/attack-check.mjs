export async function runAttackChecks(config) {
  if (config.step !== 2) {
    throw new Error('2단계 공격 점검만 지원합니다.');
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
