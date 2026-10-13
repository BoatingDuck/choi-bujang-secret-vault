# 10단계 백업 및 복구 계획

## 중요한 구분
- `src/policy-recovery.mjs`는 시험 정책 객체의 사본 확인·변경 범위 표시·시험 정책 복원만 수행한다. Supabase 운영 RLS/GRANT는 수정하지 않는다.
- `api/restore-note.js`는 **서버 전용** `RESTORE_NOTE_SNAPSHOT_B64` 사본이 사전에 안전하게 준비되고 검증되었을 때만 단일 메모 복원을 허용한다. 이 값은 Git이나 로그에 넣지 않는다.
- 과거에 존재하지 않은 백업을 생성하여 `침해 전 백업`이라고 주장할 수 없다. 안전한 상태에서 B의 시험 메모를 사전 비공개로 백업하고 검증한 이후에만 복원 실험을 진행한다.
- 복구 경로: `POST /api/restore-note`. 인증된 해당 사본 소유자만 실행 가능하며 요청은 `{ "id": "백업한 메모 UUID", "confirm": true }`이다.
- 복구 대상의 ID·소유자·제목·내용 SHA-256을 사본과 비교하며, 다른 메모와 감사 기록을 수정하지 않는다.

## 실행 및 재시험 순서
1. `node scripts/recovery-test.mjs` (로컬 시험 정책/가상 메모만 검사)
2. 1~9단계 연습: `npm.cmd run decider:test`, `npm.cmd run detect:test`, `npm.cmd run fixture:7`; 그 밖의 기존 테스트는 실제 실행 결과를 기록한다.
3. 안전한 시점에 B의 메모 한 건을 **비공개**로 보관하고 JSON `{ id, ownerId, title, body, sha256 }`를 준비한다. 해시는 `src/note-recovery.mjs`의 `noteDigest`와 동일한 규칙으로 계산한다. 내용이나 토큰은 Git/README/챗에 올리지 않는다.
4. 해당 JSON의 UTF-8 바이트를 base64로 인코딩하여 Vercel **서버 환경변수** `RESTORE_NOTE_SNAPSHOT_B64`에만 등록한다. 배포 후 테스트 B 계정으로 한 건의 POST 복원을 직접 실행한다. 타인 메모는 복원할 수 없어야 한다.
5. 실제 B 메모의 변경/삭제 시험 및 복구는 사본 검증이 끝나고 데이터 유실을 감수할 수 있는 시험 환경에서만 실행한다.
6. A 정상 요청 허용, B의 A 자료 GET/PUT/DELETE 거부, 비로그인 401, 메모 복구 후 ID·owner·hash 일치 여부 및 감사 이력 불변 여부를 직접 확인한다. **실행하지 않았으면 미실행으로 기록한다.**
7. `aleph.config.json`의 step 10, restoreRoute 및 실제 배포 상태를 대조한다. `src/attack-check.mjs`의 10단계 분기 및 배포 식별 step 10을 검증한다.

## 검증 상태
- 로컬 가상 단위 검사: 실행 후 결과 기입
- 운영 DB 백업/복원: 미실행
- 실제 정책 복구: 미실행 (시험 정책 객체만 구현)
- A/B 계정 교차 접근 재검증: 미실행
- 1~9단계 재시험: 미실행
