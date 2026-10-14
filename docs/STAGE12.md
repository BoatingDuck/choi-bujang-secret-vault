# 12단계 · 탈환 작전실 재현 및 운영 경계

> 대상 저장점: 12단계 저장점 커밋을 기준으로 확인하며, 이 문서의 설명은 기능 구성 및 재현 **절차**입니다. 모든 검사가 실제로 실행되었다는 주장이 아닙니다.

## 구현 주체와 제공 엔진

| 구분 | 출처 및 책임 | 증거 또는 한계 |
| --- | --- | --- |
| 학생 판정기 | `src/decider.mjs` · `docs/DECIDER_REQUEST.md` | ALEPH SDP 엔진이 검증해 전달한 요청 필드만 사용. `RULE_IDS`: `device_registered`, `step_up_required`, `resource_zone` |
| 학생 탐지기 | `src/detect.mjs` · `docs/DETECT_EVENTS.md` | 가상 사건 10분 창의 `GET` 120건 초과에서 `propose_revocation` 제안; 실제 세션 폐기 아님 |
| ALEPH 제공 기능 | **ALEPH SDP 엔진** | 신원·기기·경로의 사전 검증, 판정 전달, 엔진 측 접속 회수 판정. 학생 코드가 실제 엔진을 직접 구현했다고 주장하지 않음 |
| 학생 접속 앱 | `public/index.html`, `public/device-client.js`, PWA manifest·service worker | 기기 개인키 메모리 전용, 서버에 승인된 공개키가 있을 때만 보호 API 서명 생성. 앱 설치만으로 신뢰하지 않음 |
| 학생 자료실 | `api/notes.js`, `api/notes/[id].js`, `src/device-signature.mjs` | 서버 로그인·기기 서명·메모 소유권 확인. 메모 본문은 작전실에 재표시하지 않음 |
| 학생 복구 | `api/restore-note.js`, `api/restore-test-policy.js`, `src/policy-recovery.mjs` | 검증된 비공개 사본 기반. 실제 운영 RLS와 분리된 시험 정책 복원. 과거 시점 사본의 존재를 소급 주장하지 않음 |
| 학생 탈환 작전실 | `api/ops/status.js`, `src/ops-summary.mjs`, `public/ops-checks.js` | 출처 있는 데이터만 표시; 실측 요청과 로컬 fixture, `NOT_RUN`을 구분 |

## 설치

1. 저장소를 **새 폴더에 클론**하고 Node.js 22 이상과 Git을 준비한다.
2. PowerShell에서 `npm.cmd install`을 실행한다. 새 클론에서 종료코드를 확인하기 전에는 설치 시험을 `NOT_RUN`으로 표시한다.
3. Vercel 배포용 서버 전용 환경변수 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`를 운영자 비밀 설정 화면에 등록한다. 실제 값을 Git/로그/문서/JSON에 넣지 않는다.
4. 운영자가 기존 데이터베이스의 10·11단계 마이그레이션 적용 여부를 확인한다. 데이터베이스 재생성, 기존 메모 삭제, 과거 감사 기록 덮어쓰기를 수행하지 않는다.
5. `npm.cmd run build -- --local`은 **로컬 정적 빌드 확인**일 뿐 프로덕션 서버·심판 검증을 대신하지 않는다.

## 실행 및 실측

1. `npm.cmd run decider:test`, `npm.cmd run detect:test`, `npm.cmd run recovery:test`, `npm.cmd run fixture:7`을 실행한다. 각각 **로컬 가상 검사**로 기록한다.
2. `node --test .\scripts\stage11-device.test.mjs`, `node --test .\scripts\stage11-pwa.test.mjs`, `node --test .\scripts\stage12-ops.test.mjs`, `node --test .\scripts\stage12-evidence.test.mjs`, `node --test .\scripts\stage12-checkpoint.test.mjs`로 변경 사항을 검사한다.
3. 커밋과 푸시 후 Vercel의 **해당 커밋 Production Ready**를 확인한다. `/aleph.json`의 `step`과 배포 커밋을 대조한다.
4. 브라우저에 로그인하고, 새 기기의 공개키를 승인 대기로 등록한 뒤 운영자가 **해당 사용자와 기기만** 별도로 승인한다. 기기 개인키는 메모리 전용이어서 새로고침하면 새 키 등록이 필요하다.
5. 승인 기기에서 자료실의 정상 조회와 작전실 API 요약을 확인한다. 개발자 콘솔에서 서명 없는 `/api/notes` 조회는 HTTP 403, 비로그인 조회는 HTTP 401인지 **실제 응답을 받고** 기록한다. 다른 사용자 메모 ID가 없으면 교차 소유자 검사는 `NOT_RUN`으로 남긴다.
6. **안전한 통합 API 검사 실행** 버튼으로 실측 검증표를 만든다. 행별 로컬 요청 ID, 기대 HTTP, 관찰 HTTP, UTC 확인 시각을 대조하고 가린 JSON을 로컬에서 내보낼 수 있다. 요청 ID는 *클라이언트 검증 식별자*이며 엔진/서버 추적 ID가 아니다.
7. 실제 판정·탐지·회수·복구 상태와 가상 fixture의 판정은 별도 범주로 표시한다. 미연결·미실행·응답 실패를 `PASS`/`0`으로 대체하지 않는다.
8. **공식 41종 공격**은 ALEPH 제공 채점에서 실제 실행한 결과가 없으면 전체 `NOT_RUN`이다. 로컬 4/5개 PASS, `npm run bundle` 직접 점검, 이전 단계의 만점이 41종 방어 확인을 의미하지 않는다.

## 중지 · 실패 시 보호

- 브라우저 로그아웃/탭 종료는 클라이언트 세션·메모리 상 기기키 사용을 끝내는 절차지만 **서버의 기기 승인 기록을 자동 회수하지 않는다**.
- 기기를 폐기하거나 분실했을 때는 승인된 해당 기기의 DB 상태를 운영자가 `revoked`로 변경하고, 인증 세션의 별도 폐기 여부를 점검한다. 실제 회수가 완료되었는지는 DB/엔진에서 다시 조회하기 전까지 미확인이다.
- 운영 서비스를 일시 중지해야 할 경우에는 Vercel 운영 설정으로 접근을 제한한다. 배포 제거·DB 파괴를 중지 방법으로 사용하지 않는다.
- 작전실 API/실측 요청 오류 시 보호 자료를 열거나 마지막 성공 상태를 계속 표시하지 않는다. 원인을 먼저 확인하고 서버가 보낸 오류를 기록한다.

## 복구 및 되돌리기

1. 변경 전 `git status`, `git diff`, `git log -1`을 확인하여 사용자 다른 작업과 12단계 변경을 분리한다. `git reset --hard`, 무분별한 `stash pop`을 사용하지 않는다.
2. 화면 오류만 발생한 경우 이전에 검증된 커밋의 배포로 전환하거나 **해당 저장점에 대한 독립적인 revert 커밋**을 검토한다. 이력 및 기존 데이터는 유지한다.
3. 정책 복원은 **시험 정책**과 운영 RLS를 분리하고, 미리보기·버전·SHA-256·변경 범위 검증 후 명시적으로 확인한다. 메모 복원은 비공개 사본의 ID·소유자·해시 검증을 거친 **대상 한 건**만 적용한다.
4. 복원 후 정상 소유자 접근·비로그인 거부·타인 접근 거부·서명 없는 변경 요청 거부·구역 밖 조회 거부를 **실제로 재시험**한다. 시험하지 않은 항목은 `NOT_RUN`으로 남긴다.
5. 실측 결과에서 비밀값, 이메일, 개인키, 토큰, 실제 메모 본문을 제외한다. 결과를 심판 판정인 것처럼 기록하지 않는다.

## 증거 표의 해석

- `PASS`: 실제 보낸 요청의 HTTP가 기대 결과와 일치하거나 **명시된 로컬 fixture**가 일치함. 종류를 반드시 함께 표시.
- `FAIL`: 실제 전송된 요청의 HTTP가 기대와 다름.
- `UNAVAILABLE`: 요청 응답을 수신·해석하지 못해 합격 여부를 알 수 없음.
- `NOT_RUN`: 시험에 필요한 계정·기기·엔진·안전한 데이터 또는 실제 요청 실행이 없었음.
- 회수 상태는 엔진에서 실제 폐기 증거가 확인되지 않는 한 `NOT_RUN`이며, 정책 복구 버전은 서버가 읽은 사본 버전과 읽기 실패를 구분한다.
