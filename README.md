# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 포함된 메모 네 건은 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 학생이 하는 일: 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

배포가 끝나면 `/`에서 점령된 가상 자료실을 볼 수 있습니다. `/data.json`에는 같은 가상 메모가 공개됩니다. 이 공개 상태를 확인하는 것이 1단계의 출발점입니다. 1단계 접수와 심판 판정은 포털에서 확인합니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이전 제출 묶음 방식의 자리표시자입니다. 1단계에서는 학생이 편집하지 않습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 가상 화면만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. 저장소의 `src/attack-check.mjs`는 실제 배포가 된 뒤 `/data.json`을 비로그인으로 요청해 공개 가상 메모의 확인 표시를 읽습니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계부터는 자료 보호를 구현할 때 `public/data.json`을 복사하는 1단계 빌드 흐름도 함께 바꿔야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.


---

## 2단계 — 자료를 코드 밖으로 옮깁니다

<br>

### 변경 사항

- 가상 메모 4건을 Supabase PostgreSQL로 이전
- notes 테이블에 owner_id UUID 컬럼 추가
- RLS 활성화 및 anon, authenticated의 직접 읽기 권한 제거
- Vercel 서버 함수 /api/notes 추가
- Supabase 접속 정보는 서버 환경변수에서만 사용
- 공개 data.json 복사 기능 제거
- 브라우저의 데이터 조회 경로를 /api/notes로 변경

<br>

### 최신 저장소 및 배포 파일 검사

배포 완료 후 다음 항목을 확인한다.

1. GitHub 최신 커밋에서 가상 메모 본문 검색
2. 배포된 정적 파일과 JavaScript에서 메모 본문 검색
3. /data.json 직접 요청 시 404 또는 메모 0건 확인
4. /aleph.json 정상 응답 확인
5. 첫 화면의 보안 응답 헤더 확인

GitHub에서는 저장소 검색을 사용하고, 로컬에서는
다음 명령어로 가상 메모 문장의 노출 여부를 점검한다.

git grep -n -E '실습용.*기[록]' HEAD

검색 결과는 최종 커밋 및 배포 후 기록한다.

<br>

### 현재 남아 있는 취약점

/api/notes는 아직 사용자 인증을 요구하지 않는다.
따라서 외부 사용자가 비로그인 상태로 API를 호출하면
가상 메모를 조회할 수 있다.

이 문제는 이후 단계의 인증 및 접근 통제에서 해결한다.

<br>

### 과거 공개 이력의 한계

최신 파일에서 메모를 제거하더라도
GitHub의 과거 공개 커밋과 이전 Vercel 배포에
자료가 남아 있을 수 있다.

따라서 최신 파일에서 노출이 제거됐다는 사실만으로
과거 노출까지 완전히 해소됐다고 판단하지 않는다.

<br>

### 2단계 검증 결과 (2026-10-10)

<br>

#### 데이터베이스 검증
- Supabase PostgreSQL에 가상 메모 4건 저장 확인
- owner_id UUID 컬럼 존재 확인
- RLS 활성화: true
- anon SELECT 권한: false
- authenticated SELECT 권한: false
- service_role SELECT 권한: true

<br>

#### GitHub 및 공개 파일 검증
- 2단계 커밋: 0921bc0
- 커밋 대상에서 가상 메모 본문 패턴 검색: 결과 없음
- 공개 data.json 제거 확인
- 배포된 /data.json 요청: HTTP 404
- 배포된 /aleph.json: 정상 응답, step 2 확인
- 배포된 JavaScript 전체 검색: 별도 확인 예정

<br>

#### 화면 및 API 검증
- 첫 화면에 가상 메모 카드 4건 표시 확인
- /api/notes 비로그인 요청: 메모 4건 조회 성공
- API 응답에 Supabase Secret Key 미포함 확인
- 첫 화면 HTTP 응답: 200 OK
- X-Content-Type-Options: nosniff 확인

<br>

#### 남아 있는 보안 문제
- /api/notes에는 아직 사용자 인증이 없음
- 비로그인 사용자도 API를 통해 가상 메모를 조회할 수 있음
- 이 취약점은 이후 단계에서 접근 통제를 구현하여 해결할 예정

<br>

#### 과거 공개 이력의 한계
- 과거 GitHub 공개 커밋에는 가상 메모가 남아 있을 수 있음
- 이전 Vercel 배포에서도 기존 자료에 접근할 가능성이 있음
- 최신 배포의 노출 제거가 과거 노출까지 해결했다는 의미는 아님


---


## 4단계 — 로그인해도 내 자료만 보이게 합니다

<br>

### 구현 내용

- 기존 가상 메모 4건을 A 계정에 연결하고 B 계정에 시험용 메모 1건 생성
- JWT 검증으로 확인한 사용자 ID를 기준으로 메모 소유권 검사
- GET 목록 조회에서 본인 소유 메모만 반환
- POST에서는 검증된 사용자 ID를 owner_id로 저장
- 개별 GET·PUT·DELETE에서 메모 UUID와 소유자 ID를 함께 검사
- 타인 메모 접근은 404 JSON으로 거부
- Supabase RLS에 SELECT·INSERT·UPDATE·DELETE 소유권 정책 적용
- anon 직접 접근 권한 제거, authenticated CRUD 권한 부여

<br>

### 실제 검증 결과

- A 계정 로그인: 본인 메모 4건 표시
- B 계정 로그인: 본인 메모 1건 표시
- B 계정으로 A 메모 직접 GET: HTTP 404
- B 계정으로 A 메모 직접 PUT: HTTP 404
- B 계정으로 A 메모 직접 DELETE: HTTP 404
- 공격 후 메모 개수: A 4건, B 1건 유지

<br>

### 실행 및 확인 방법

1. npm.cmd run build -- --local 로 로컬 빌드 검사
2. git push origin main 후 Vercel 배포 상태 확인
3. A/B 계정으로 각각 로그인하여 본인 메모만 표시되는지 확인
4. 상대방 메모 UUID로 GET·PUT·DELETE 요청 시 404 확인
5. npm.cmd run bundle 로 제출 묶음 생성

<br>

### 남은 확인 사항

- A/B 양쪽에서 자기 메모의 추가·수정·삭제 재검증
- 직접 Data API에 대한 anon 권한과 RLS 적용 결과 점검
- 공식 심판의 4단계 공격 판정

---

## 5단계 저장점 — 자료 요청을 서버 한곳으로 모읍니다

<br>

### 구현 및 변경 사항

- 브라우저의 메모 조회·추가·수정·삭제는 기존 Vercel 서버 함수(`/api/notes`, `/api/notes/:id`)를 통해 처리한다. 브라우저에서 Supabase Data API를 직접 호출하는 메모 CRUD 코드는 없어 수정하지 않았다.
- Supabase Auth 로그인·로그아웃 기능은 기존 구현을 유지하였다.
- `public.notes` 테이블의 `PUBLIC`, `anon`, `authenticated` 직접 접근 권한을 회수하고, 서버 함수에서 사용하는 `service_role`의 CRUD 권한은 유지하였다.
- 서버 함수의 JWT 인증 및 메모 소유권 검사를 유지하였다.
- `aleph.config.json`의 단계를 5로 변경하고 원본 Data API 주소를 `originalApiUrl`에 등록하였다.

<br>

### 직접 검증

- 권한 변경 전 A 계정에서 메모 조회·추가·수정·삭제 정상 동작을 확인하였다.
- 권한 변경 후 A 계정에서 기존 메모 4건이 정상 표시됨을 확인하였다.
- `anon`, `authenticated` 역할의 SELECT·INSERT·UPDATE·DELETE 권한이 모두 false이며 `service_role`은 모두 true임을 확인하였다.
- Supabase 원본 Data API에 공개 키로 직접 조회를 요청한 결과 HTTP 401, PostgreSQL 오류 코드 42501(permission denied for table notes)이 반환되어 메모가 노출되지 않았다.

<br>

### 남은 검증

- 인증된 사용자 토큰을 이용한 원본 Data API 직접 조회·수정 차단 확인
- B 계정의 다른 사용자 메모 접근 차단 및 무로그인 서버 API 접근 거부 재확인
- 5단계 배포 및 공식 채점 결과 확인

---

## 6단계 저장점 — 등록한 기기만 자료실에 들어옵니다

<br>

### 구현 내용

- `docs/DECIDER_REQUEST.md`의 계약에 따른 최상위 `request.deviceRegistered`를 검사한다.
- `RULE_IDS`에 실제 구현 규칙 `device_registered`를 등록한다.
- `deviceRegistered === true`이면 `allow` / `approved`를 반환한다.
- `false`, 값 누락 및 그 밖의 모든 값은 `deny` / `device_not_registered`를 반환한다.
- 응답은 계약의 다섯 항목 `schema`, `requestId`, `decision`, `reasonCode`, `ruleIds`로만 구성한다.
- 기존 브라우저 화면, 로그인 및 자료실 API 코드는 변경하지 않는다.
- 인증서, CA, 개인키, 서버 키는 생성하거나 저장소에 추가하지 않는다.

<br>

### 로컬 확인 방법

1. `npm run decider:test`를 실행한다. (Windows PowerShell에서 npm 실행이 제한되면 `npm.cmd run decider:test`)
2. `통과 · 등록 기기의 정상 요청`을 확인한다.
3. `통과 · 미등록 기기의 가상 요청`을 확인한다.
4. 두 번째 요청의 응답은 `deny`, `device_not_registered`이다.
5. 로컬 가상 시험은 운영 심판의 판정을 의미하지 않는다.

<br>

### 제출 전 확인

1. `aleph.config.json`의 `step` 값이 6이고 기존 발급자·경로·API 주소가 유지되는지 확인한다.
2. `git status`, `git diff`로 6단계 수정 사항과 다른 작업을 구분한다.
3. 비밀값이 없는지 확인한 뒤 6단계 저장점으로 커밋한다.
4. `npm run bundle`을 실행하여 제출 JSON의 `step: 6`, `policyRules: ["device_registered"]` 및 마지막 커밋 정보를 확인한다.
5. `bundle-notes.json`, `artifacts/submission.json`은 커밋하지 않는다.

---

## 7단계 저장점 — 평소와 다른 접속은 다시 확인합니다

### 구현 내용
- 6단계의 `device_registered` 규칙을 유지하였다.
- 엔진이 전달한 `signals`와 `recentEvents`를 사용하여 복합 이상 접속을 판정하였다.
- 비정상 시각, 낯선 네트워크, 다수의 위험 사건이 함께 확인되면 `step_up`을 반환하도록 하였다.
- 지역 정보 하나만으로 사용자를 영구 차단하지 않는다.
- 엔진이 확인한 최근 추가 인증 정보가 있으면 해당 요청을 다시 판정한다.
- 브라우저가 전달한 위치 헤더나 임의로 생성한 인증 정보는 사용하지 않았다.

### 로컬 검증 결과
- `npm run decider:test`: 등록 기기, 미등록 기기, 복합 이상 접속, 재확인된 복합 이상 접속 등 4개 테스트 통과
- `npm run fixture:7`: 정상 사건 `allow`, 복합 이상 사건 `step_up` 확인

### 검증 범위와 한계
- 이번 시험은 엔진의 요청 형식을 사용한 가상 사건 검사이다.
- 실제 재로그인에 따른 토큰 갱신 및 자료 접근 차단은 검증하지 않았다.
- 실제 접속 지역을 확인하거나 위치 기반 접근을 차단하는 기능은 구현하지 않았다.

### 재현 방법
1. 프로젝트 루트에서 `npm run decider:test`를 실행한다.
2. 네 가지 가상 요청이 모두 통과하는지 확인한다.
3. `npm run fixture:7`을 실행한다.
4. 정상 사건은 `allow`, 복합 이상 사건은 `step_up`인지 확인한다.

---

## 8단계 — 자료마다 갈 수 있는 구역을 나눕니다

### 구현 내용

- 기존 `device_registered` 기기 등록 규칙을 유지하였다.
- 기존 `step_up_required` 복합 이상 접속 추가 인증 규칙을 유지하였다.
- `resource_zone` 규칙을 추가하여 메서드와 정확한 자원 경로를 검사하도록 하였다.
- 메모 목록과 개별 메모의 허용 경로를 구분하였다.
- `/notes/export` 등 허용되지 않은 기능 경로는 거부하도록 하였다.
- 기존 자료 API의 검증된 사용자 ID와 메모 소유자 비교 조건을 보존하였다.

### 로컬 검증 결과

- `node --check .\src\decider.mjs`: 문법 검사 통과
- `npm.cmd run decider:test`: 4개 항목 통과
- `npm.cmd run fixture:7`: 정상 사건 `allow`, 복합 이상 사건 `step_up`
- `/notes/export` 가상 요청: `deny`, `access_denied`

### 남은 검증 및 한계

- `access_denied`가 공식 판정 이유 코드로 허용되는지 확인 필요
- 실제 API에서 다른 사용자 메모의 목록·조회·수정 차단 재검증 필요
- 강사 공지를 구분하는 자원 및 검증된 강사 권한은 아직 구현되지 않음
- 판정 요청 계약에 소유자·강사 역할 정보가 없어 해당 권한을 판정기에서 직접 확인하지 못함
- 로컬 판정기 검사 결과는 공식 심판의 공격 차단 결과가 아님

### 재현 방법

1. `npm.cmd run decider:test`를 실행한다.
2. `npm.cmd run fixture:7`을 실행한다.
3. 정상 사건은 허용되고 복합 이상 접속은 추가 인증으로 판정되는지 확인한다.
4. 허용되지 않은 자원 경로가 거부되는지 확인한다.

## 9단계 저장점
- `src/detect.mjs`에서 사용자별 10분 내 GET 120건 초과를 탐지해 `propose_revocation`을 제안한다. 로컬 `npm.cmd run detect:test` 6/6 통과를 확인하였으며 실제 회수는 별도 심판 판정이다.

## 10단계 — 백업에서 자료실을 되살립니다
- 시험 정책 및 단일 메모 복구 구현과 미실행 항목은 `docs/STAGE10.md` 참조.
- 로컬 재검사: `npm.cmd run recovery:test`, `npm.cmd run decider:test`, `npm.cmd run detect:test`.
- 실제 복원 전 비공개 B 메모 백업 확보 및 검증이 필수다.
