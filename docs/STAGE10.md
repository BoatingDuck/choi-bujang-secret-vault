# 10단계 — 실제 복구 범위와 실패 시 중단 조건

## 제작 1. 침해 전 검증된 시험 정책 백업

- `src/policy-recovery.mjs`의 `SAFE_POLICY`는 **운영 Supabase 정책이 아니라 시험 데이터**다.
- 정책 백업은 `recovery_private.stage10_test_policy_backup`에 별도로 저장된다. 버전 `owner-notes-v1`과 SHA-256 고정값에 일치해야 사용한다.
- DB의 백업에 UPDATE/DELETE를 금지하는 트리거를 둔다. 이 구조가 설치되기 전 시점의 사본이 존재했다고 주장할 수는 없다.
- 미리보기 `POST /api/restore-test-policy` `{ "confirm": false }`: 백업 버전·고정 해시·현재 revision·변경될 필드를 반환한다.
- 저장된 백업이 없거나 값이 다르면 미리보기 및 복원을 모두 중단한다.

## 제작 2. 시험 정책만 복구

- 요청 `{ "confirm": true, "expectedRevision": <미리보기 revision>, "expectedSha256": "<미리보기 backupSha256>" }`.
- SQL `stage10_policy_apply`는 DB 트랜잭션 및 행 잠금에서 사본 검증을 반복하고, 실험용 정책 키만 업데이트한다.
- 기타 시험 설정 키·다른 서비스 규칙을 보존한다. 운영 `public.notes`, 운영 RLS, GRANT, 인증 감사 테이블은 변경하지 않는다.
- 테스트 계정 B는 `STAGE10_TEST_B_USER_ID` 서버 설정으로 명시적으로 허용할 수 있고, 공식 심판 B는 서명된 신원으로 식별한다.

## 제작 3. 지정된 B 메모 하나만 복구

- `POST /api/restore-note` 서비스: 배포 Vercel 서버 함수 / Supabase 서비스 역할 백업 조회.
- 미리보기 `{ "id": "uuid", "confirm": false }`: 비공개 사본 검증 후 버전 및 변경 필드를 반환한다.
- 적용 `{ "id": "uuid", "confirm": true }`: 검증된 사본을 **다시 읽고**, ID·소유자·버전·해시와 변경 사항을 비교하여 같은 UUID 한 건만 업데이트/삽입한다.
- 기록 복원 후 DB를 재조회하고 사본과 동일한 ID·소유자·해시인지 검사한다. 해시의 범위는 사본 출처에 따른 `hashScheme`으로 표시한다.
- DB 사본 부재/불일치, 소유자 불일치, 쓰기 실패는 성공으로 보고하지 않는다.
- 다른 메모/감사 기록은 이 복원 함수에서 수정하지 않는다. 감사 로그의 이전·이후 전체 비교는 별도 수행하지 않았다.

## 제작 4. 복구 뒤 재시험 기록

1. 사본 미리보기/버전/변경 범위 확인, 검증 실패 시 중단.
2. 시험 정책 적용 전 미리보기 확인, revision 및 SHA-256 지정, 다른 서비스 규칙 보존 확인.
3. 시험 B 메모 한 건 복원 후 본인 GET이 200인지 확인.
4. 비로그인 GET이 401인지 확인.
5. 잘못된 JWT의 GET이 401인지 확인.
6. B에서 A 소유 메모 GET이 404인지 확인.
7. B에서 A 소유 메모 PUT/DELETE 404는 안전한 별도 실습 환경에서만 확인. 자동 재시험에서는 `NOT_RUN`이다.
8. 과거 1~9단계 정상·금지 테스트 중 `decider:test`, `detect:test`, `fixture:7`과 실제 배포 점검을 다시 실행한다. 심판 계정으로 수행하지 않은 시험은 `NOT_RUN`으로 구분한다.
9. 감사 기록의 사전·사후 해시 또는 건수 비교는 수행한 경우에만 PASS로 기록한다.

## 사용자에게서 확인된 실제 결과 (2026-10-14)

- DB 사본 연결 6/6, 저장된 백업 SHA-256 검증 6/6.
- 배포된 B 계정 메모 복원 HTTP 200 및 `restored: true`.
- 복원 직후 서버 내부 API 핸들러 재시험: 본인 GET 200, 비로그인 GET 401, 위조 JWT GET 401, 타인 GET 404.
- PUT/DELETE 타인 요청, 감사 이력 전체 비교, 공식 1~9단계 재시험 및 심판 B 복원은 `NOT_RUN`/미확인.
- 실제 Supabase 운영 정책에 대한 복원은 수행하지 않는다.

## 실행 명령

```powershell
npm.cmd run recovery:test
node .\scripts\policy-verify.test.mjs
npm.cmd run decider:test
npm.cmd run detect:test
npm.cmd run fixture:7
node --check .\api\restore-note.js
node --check .\api\restore-test-policy.js
```

최종 심판 판정 전까지 세 실패 코드의 해결 여부를 확정하지 않는다.
