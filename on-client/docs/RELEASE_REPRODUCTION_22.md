# 은셰브 22단계 | 새 환경 재현 및 릴리스 검증 기록

> **기록 성격:** 학생이 직접 수행한 재현에 대한 진술·화면 증거. 서버가 학생 PC에서 코드를 실행했다는 인증이 아니다. 공식 22단계 AI 원문 검토·통과와도 구분한다.
>
> **릴리스 상태:** **검증 중(UNV)** · 앱 패키지 버전 **`0.2.19`**. 운영 배포 인증 또는 **v1.0이 아니다**. 실제 원천 보안 조치 집행과 전체 운영 연결은 미완료/미확인이다.

## 1. 제출 대상·커밋 기준·환경

| 항목 | 확인 사실 / 계약 |
| --- | --- |
| 학생 보안 Agent | 은셰브 (제공 실행 도구의 기본 문구 `케셰브`와 구분) |
| 저장소 URL | `https://github.com/BoatingDuck/choi-bujang-secret-vault` |
| 기본 브랜치 | `main` |
| **실제로 새 폴더에서 실행한 기준 커밋** | `36c7f03ecd9402b0401e8295502aaf8765b86f04` (21단계 개발일지 커밋) |
| **22단계 제출 최종 커밋** | **이 문서를 포함하여 커밋·푸시한 후 과제 화면에 입력할 40자리 SHA를 `git rev-parse HEAD`로 확인한다. 문서 작성 전에 존재하지 않는 SHA를 임의로 적지 않는다.** |
| 실제 새 폴더 | `$HOME\choi-bujang-secret-vault-repro-22` (실측 예: `C:\Users\User\choi-bujang-secret-vault-repro-22`; 사람마다 경로 변경) |
| 보존된 원래 폴더 | `$HOME\choi-bujang-secret-vault` |
| 실행 작업 위치 | 새 폴더의 `on-client` |
| 재현일 | **2026-10-30 KST** |
| 환경 점검 확인 시각 | **2026-10-30 09:11:49 +09:00** (PowerShell 직접 출력) |
| 런타임 | Windows PowerShell `5.1.26100.9711`, Node.js `v24.19.0`, npm `11.17.0` |
| 앱 버전 | `on-client/package.json`의 `0.2.19`; Node `engines.node`는 `24.19.0` |
| 서버 바인딩·주소 | `127.0.0.1`, 브라우저 `http://127.0.0.1:5189/` |
| 실행 모드 | **`-NoNativeHost`**; 실제 인증 및 외부 SDP·XDR·AI 연결의 성공 증거가 아님 |
| demo 여부 | `-Demo` **미사용**; 예제 자료를 실측 운영 데이터로 적지 않음 |
| 기존 단계 상태 | **21단계 공식 통과 확인** (학생이 대화에서 통보). 단, 이전 단계별 별도 제출 결과가 현재 최종 커밋 전체의 실행 성공 증거는 아님 |

**커밋 일치 원칙:** 본문에서 관찰한 실행 커밋은 `36c7f03…`이다. 22단계 문서·스크린샷·README 링크를 더한 새 커밋이 최종 제출 SHA가 되므로, **최종 커밋에서도 동일한 실행 파일이 유지되는지 `git diff`로 검사하고 그 최종 SHA를 새 폴더에서 재체크아웃해 실행 확인한다**. 확인 전까지 새 SHA가 재현됐다고 주장하지 않는다. 이 문서의 기록은 실행 당시 근거를 보존하며, 추후 최종 검증은 제출 시각과 SHA를 별도 증거로 남긴다.

## 2. 유지한 기능·수정 범위·입력 계약

이번 단계는 **학생 실행 결과 문서와 버전 기록**만 추가하며, 13~20단계 기존 학생 코드를 재작성하지 않았다. 제공 서버·`public/app.js`·보안 판정·인증 설정도 변경하지 않는다.

- **학생 표시:** `on-client/student/extension.mjs`의 `createStudentView({api,onChange})`와 `renderIdentity({me,devices,sessions})`, `renderDecision({status,mode,data,error,appId})`, `renderEvents({status,mode,data,error})`, `renderStatus({devices,sessions,notifications,diagnostics,mode})`, `renderAiConnection({status,mode,data,error,checkedAt})`, `renderExplanation({event,explanation,checkedAt})`, `renderAction({status,event,actionId,target,receipt,observation,message,confirmationExpiresAt,error})`, `renderVulnerabilities({status,mode,data,error})`. 전달된 상태를 DOM/문구로 표시하는 영역이며 인증·판정·집행 원천이 아니다.
- **제공 진입점:** `on-client/tools/start-alekov.ps1` → `src/server.mjs`; `public/index.html`·`public/app.js`가 제공 UI와 API 호출을 담당한다. `student/engine-adapter.mjs` 기본 연결 모드는 `disconnected`다.
- **설정 설명:** `on-client/.env.example`의 `ON_PORT`, `ON_ENGINE_ADAPTER`, `ON_AI_MODEL`, `ON_PROJECT_DIRECTORY`, `ON_APPROVED_PUBLIC_PACKAGES`는 공개 가능한 **키 이름/기본 견본**이며 실제 자격·연결 성공을 뜻하지 않는다. 비밀을 Git에 넣거나 기존 PC에서 그대로 복제하지 않는다.
- **의존성:** `on-client/package.json`에는 외부 `dependencies`/`devDependencies`가 없고, 이 커밋의 `on-client`에는 자체 `package-lock.json`이 없다. 최상위 `package.json`/`package-lock.json`은 별도 기존 프로젝트이며 이번 앱 실행에 혼용하지 않는다. 새 환경에서 `npm install`·`npm ci`는 실행하지 않았다.
- **버전 주의:** 도움정보 JSON의 `data.version: "0.1.0"`은 진단 컴포넌트의 식별값으로, 실제 앱 패키지 `0.2.19`와 다른 필드다.

## 3. 새 빈 폴더 재현 절차 (실제 수행)

### 3.1 원래 폴더 보존 확인

원본 저장소에서 `git branch --show-current` → `main`, `git rev-parse HEAD` → `36c7f03ecd9402b0401e8295502aaf8765b86f04`, `git status --short` → 빈 출력 확인. `.git`, `on-client/student/extension.mjs`, `on-client/docs/STUDENT_RUNBOOK.md`, `on-client/docs/development-log/21-student-runbook.md` 모두 존재 확인. **2026-10-29 17:47:56 +09:00** 출력으로 확인했다.

### 3.2 GitHub에서 별도 폴더에 해당 커밋 받기

실제로 아래 절차로 복제했다. **이미 존재하는 폴더에 다시 실행하거나 원본을 삭제하지 않는다.** 복제 대상은 새 빈 경로여야 한다.

```powershell
$repo = 'https://github.com/BoatingDuck/choi-bujang-secret-vault.git'
$repro = Join-Path $HOME 'choi-bujang-secret-vault-repro-22'
$base = '36c7f03ecd9402b0401e8295502aaf8765b86f04'
if (Test-Path $repro) { throw '대상 경로가 이미 있습니다. 기존 폴더는 보존하세요.' }
git clone --branch main --single-branch $repo $repro
if ($LASTEXITCODE -ne 0) { throw 'clone 실패' }
git -C $repro checkout --detach $base
if ($LASTEXITCODE -ne 0) { throw 'checkout 실패' }
git -C $repro rev-parse HEAD
git -C $repro status --short
```

**실측:** Git clone 성공(578 objects 수신), `HEAD is now at 36c7f03`, 40자리 SHA 정확히 일치, 재현 폴더 변경사항 없음, `on-client/package.json`·`student/extension.mjs`·`docs/STUDENT_RUNBOOK.md` 존재(`True` 3개).

### 3.3 런타임·설치·포트·실행

```powershell
Set-Location (Join-Path $HOME 'choi-bujang-secret-vault-repro-22\on-client')
Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'
node --version
npm.cmd --version
$PSVersionTable.PSVersion.ToString()
(Get-Content .\package.json -Raw | ConvertFrom-Json).version
Test-Path .\src\server.mjs
Test-Path .\tools\start-alekov.ps1
Test-Path .\student\extension.mjs
Test-Path .\docs\STUDENT_RUNBOOK.md
Get-NetTCPConnection -LocalPort 5189 -State Listen -ErrorAction SilentlyContinue
```

**실측:** 2026-10-30 09:11:49 KST, Node `v24.19.0`, npm `11.17.0`, PowerShell `5.1.26100.9711`, 앱 버전 `0.2.19`, 필수 파일 `True` 4개, 포트 5189 리스너 없음. 별도 의존성 설치 작업 없음.

```powershell
# 새 폴더의 on-client 에서 수행; 원래 폴더 아님
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1 -NoNativeHost
```

**실측:** 서버 정상 시작 안내가 표시됐고 `http://127.0.0.1:5189/` 브라우저 화면, 「현재 로그인」 및 학생 `renderIdentity` 카드가 표시됐다. **실제 SDP 인증 또는 AI 게이트 연결은 확인되지 않았다.**

### 3.4 종료·재실행

1. **종료:** 새 폴더 서버 실행 창에서 `Ctrl+C`를 누르고 브라우저 새로고침 → **접속 불가** (학생 직접 보고; 정확한 브라우저 오류 코드까지는 별도 기록하지 않음).
2. **재실행:** 동일한 새 폴더 `on-client`에서 동일한 `start-alekov.ps1 -NoNativeHost` 실행 → 브라우저 새로고침 후 **다시 화면 열림** (학생 직접 보고).
3. 단독 앱 시작·중단·재시작이 확인됐으나 인증·SDP/XDR·AI·조치·OSV의 실연동 상태는 변경되지 않았다.

## 4. 13~21단계 기능별 재현 결과·확인 시각·근거

**상태 판정 규칙:** 이 표의 `재현됨`은 **적힌 범위의 로컬 화면/표시 동작에 한정**한다. 서버·인증·외부 연동이 없어 실제 데이터를 받을 수 없는 경우는 `연결 없음`, 시도하지 않았거나 결과가 없으면 `확인 불가`로 기록한다. 이전 단계별 원문 판정과 새 폴더 실행 관찰은 별개다. 날짜는 KST이고 정확한 시각을 확보하지 못한 화면은 시간을 꾸며 쓰지 않는다.

| 단계 | 확인한 기능 | 결과 | 확인 시각 (KST) | 비고·근거·미확인 원인 |
| --- | --- | --- | --- | --- |
| **13** | 본인·기기·세션 카드, `renderIdentity`, 다시 불러오기 전후 화면 | **재현됨: 오류/연결 없음 상태 표시** | 2026-10-30, 시각 미기록 | [화면 증거](reproduction-evidence/22-13-identity.png). 사용자·기기·세션 각각 `확인 불가 (요청 실패)`; 학생 화면 `연결 모드: 연결 없음`, 연결 실패 안내. 새로고침 전후 같은 상태. 일시적 로딩 표시는 관찰하지 못함. **실제 인증·조회는 연결 없음.** |
| **14** | 업무 앱 접속 요청, 판정 결과, `renderDecision` 대기 UI | **재현됨: 연결 불가/요청 전 표시** | 2026-10-30, 시각 미기록 | [화면 증거](reproduction-evidence/22-14-access-decision.png). 앱 목록·접속 요청 없음, 서버/에이전트 연결 실패 문구. **실제 allow/deny/challenge/unknown 판정 실행은 확인 불가.** |
| **15** | 「접속·XDR 기록」 카드, `renderEvents` 조회 실패 UI | **재현됨: 연결 실패 표시** | 2026-10-30, 시각 미기록 | [화면 증거](reproduction-evidence/22-15-xdr-events.png). `연결 없음`, 기록을 불러오지 못함. **실제 기록·XDR 수집/조회는 연결 없음; 사건 0건으로 판정하지 않음.** |
| **16** | 「도움정보 불러오기」, 로컬 진단 JSON과 오류 코드 | **재현됨: 로컬 진단 응답** | **2026-10-30 09:18:25** (응답 `checkedAt` 환산) | [요청 ID 가린 화면](reproduction-evidence/22-16-diagnostics-redacted.png). `meta.mode: disconnected`, `engine.code: ENGINE_NOT_CONNECTED`, `ai.configured: false`, `ai.authorized: false`, `data.version: 0.1.0`(진단 필드). **외부 연동은 연결 없음.** |
| **17** | 「AI 연결」 초기 안내, 「AI 연결 점검」, `renderAiConnection` | **재현됨: 연결 전/점검 전 표시** | 2026-10-30, 시각 미기록 | [연결 안내](reproduction-evidence/22-17-ai-connection.png), [점검 전 카드](reproduction-evidence/22-17-20-ai-check-packages.png). 계정 승인 미확인·AI 연결 미시작·`AI 연결 점검 전`. **실제 승인/모델 호출 미실행·확인 불가.** |
| **18** | `renderExplanation` 사건 미선택 안내 | **재현됨: 요청 전 표시** | 2026-10-30, 시각 미기록 | [화면 증거](reproduction-evidence/22-18-19-explanation-action.png). `보안 기록에서 기록을 먼저 고르세요.` **실제 사건 없음·유료 AI 설명 요청 미실행, 근거 검증 결과 확인 불가.** |
| **19** | 조치 준비/원천 결과 UI, `renderAction`의 `idle` | **재현됨: 미실행 상태 표시** | 2026-10-30, 시각 미기록 | [화면 증거](reproduction-evidence/22-18-19-explanation-action.png). `아직 미실행(idle)`과 `supportedActions`가 비면 준비 버튼 없음 안내. **실제 원천 집행·효과 관측 미실행/지원 미확인(UNV).** |
| **20** | 「설치 패키지와 취약점 정보」, `renderVulnerabilities` 조회 전 UI | **재현됨: 조회 전 표시** | 2026-10-30, 시각 미기록 | [화면 증거](reproduction-evidence/22-17-20-ai-check-packages.png). `조회 대기`, `조회 전`. **설치 패키지·OSV 외부 조회 미실행, 취약점 없음으로 단정 불가.** |
| **21** | `STUDENT_RUNBOOK.md`에 따라 새 폴더에서 실행·브라우저·종료·재실행 | **재현됨: 로컬 실행 절차** | 2026-10-30, 환경 점검 **09:11:49**, 그 외 시각 미기록 | 사용자 PowerShell `clone`·커밋·버전·파일 존재·포트 점검 출력과 브라우저 관찰·종료·재시작 진술. **실제 SDP·AI 연결은 확인하지 않음.** |

**13~20 단계들의 과거 별도 공식 판정**은 당시 커밋의 소스 원문에 대한 평가로, 위 재현 커밋에서 외부 기능 전체를 다시 실행했다는 뜻이 아니다. 21단계 공식 통과는 학생이 직접 통보했으나 이 새 환경 재현의 외부 운영 인증은 아니다.

### 4.1 화면 캡처 원본·증거 관리

이번 기록의 PNG 7개는 학생이 2026-10-30 대화에서 제공한 **새 폴더 실행 화면 캡처**다. `reproduction-evidence/`에 증거 파일로 보존한다. 16단계의 요청 식별자(`requestId`)는 공개 기록에 불필요하므로 해당 부분만 `[REDACTED requestId]`로 가리고 `-redacted.png`로 별도 저장했다. **상태값·진단 시각·컴포넌트·엔진 코드·AI 설정 상태를 수정하지 않았다.** 화면 캡처만으로 연결된 원천 시스템의 성공·정책 판단·실제 집행을 입증하지 않는다.

## 5. 이동 가능한 구성·설정·제한

1. **필수 소스:** Git 저장소의 `on-client/package.json`, `src/`, `public/`, `student/`, `tools/start-alekov.ps1`, `docs/`, `.env.example`. GitHub `main`의 특정 커밋으로 고정하고 폴더명·사용자 경로는 달라질 수 있다.
2. **런타임:** Windows PowerShell 및 Node.js 22~24(수업·이번 실측 `v24.19.0`)를 설치·확인한다. Node/npm은 이 PC에 기존 설치되어 있었으며 **새 PC에서 설치 프로그램을 실행한 실적은 없다**. `on-client` 앱에는 현재 외부 npm 의존성이 없으므로 `npm install`을 수행하지 않았다.
3. **인증과 설정:** 공개 견본 `.env.example`만 커밋한다. 현재 재현은 `-NoNativeHost`이므로 비공개 `native`·SDP 자격을 이전하거나 복원하지 않았다. 실제 연동 재현이 필요하면 담당자의 승인 절차·비밀 저장소·프로젝트별 신원 설정이 별도로 필요하다.
4. **시스템 경계:** 브라우저 → 로컬 `src/server.mjs` → 제공 엔진/SDP·XDR 연결, AI 게이트·보안 조치·OSV 스캐너. `student/extension.mjs`는 API가 준 상태를 표시한다. 데이터·설정·키를 하드코딩하여 `127.0.0.1`의 화면 성공을 외부 연결 성공으로 바꾸지 않는다.
5. **설정 검사:** 비밀 없는 `.env.example`에 예시가 있다는 사실만으로 실제 `ON_PROJECT_DIRECTORY`가 설정된 것은 아니다. 공개 패키지 조회 승인 목록이 비면 OSV 결과는 미조회일 수 있다.

## 6. 데이터 보존·백업·복원 계획 (아직 복원 시험 미실행)

| 대상 | 보존/백업 방안 | 복원 절차 | 실제 검증 수준·제한 |
| --- | --- | --- | --- |
| **학생 코드·제공 소스·문서·Git 이력** | 기존 폴더를 삭제하지 않고 `git status --short`·커밋 해시 검토 후 `main`에 푸시. 제출 SHA를 별도 기록 | **새 빈 폴더**에 `git clone` → `git checkout --detach <검증한 40자리 SHA>` → 파일·버전 대조 | **소스 복원 검증됨**: `36c7f03…` 기준 별도 폴더 clone/checkout. 최종 문서 커밋에 대해서는 제출 직전 재검증 필요 |
| **실행 설정 견본** | 비밀 없는 `.env.example`만 Git에서 관리. 환경별 실제 값을 학생 문서에 기록하지 않음 | 제공 견본의 키 이름과 담당자 안내를 비교하고, 비밀 없는 부분만 환경에 맞게 재설정 | **견본 존재는 소스 대조로 확인**. 운영 연결 설정 복원 미실행 |
| **계정 인증·AI·SDP 자격** | 승인된 사용자 프로필/자격 저장소 등 **프로젝트 외부**의 비공개 보관 경계 유지. 소스 ZIP·Git·화면 캡처에 복사하지 않음 | 운영자 승인된 기기 등록·재인증·재발급 절차 사용; 이전 PC의 자격을 무단 복제하지 않음 | **복원 미실행**. 새 폴더는 `-NoNativeHost`로 실행함 |
| **사용자/프로젝트 업무 데이터·XDR 사건 기록** | 원천 서버 또는 승인된 데이터 저장소의 보존/백업 정책을 확인하고, 사용자 범위·보존 기간·권한을 지정한 공식 방법으로 별도 백업 | 운영자가 허가한 공식 복원·권한/건수/시각 대조로 확인. 삭제·임의 DB 덮어쓰기·로컬 내용으로 실제 사건 재구성 금지 | **원천 접근/백업/복원 미확인**. 카드가 표시된 것을 자료가 복원됐다고 해석하지 않음 |
| **학생의 실행 증거** | 실제 확인 날짜·커밋·기능 상태·민감 정보 제거 PNG를 `docs/reproduction-evidence/`에 함께 커밋 | 최종 커밋에서 MD 링크/파일 존재와 SHA를 대조 | 증거 파일을 준비함. **이미지/문서만으로 서버 측 실행 인증을 주장하지 않음** |

실제 사용자 데이터베이스를 이 단계에서 자동 백업하거나 복원하지 않았다. 원래 프로젝트 및 `Git` 기록은 유지했으며 `git reset --hard`, 강제 삭제, 자격 파일 복사는 수행하지 않았다. 보호해야 할 별도 로컬 데이터가 발견되면 승인·보존 정책부터 확인하고 **별도 암호화·접근 제한된 백업**을 마련한 뒤 복원 검증 전까지 `미확인`으로 남긴다.

## 7. 최종 커밋 일치 검증 및 제출 절차 (실행 전 체크)

22단계 학생 문서와 README 링크·증거 이미지를 기존 **원본 작업 폴더**에 추가해 단일 문서 커밋으로 만들며, **재현용 clone에는 결과를 작성하거나 새 커밋을 만들지 않는다.** 아래 검증에서 파일·함수가 달라지면 다시 실제 실행하고 문서를 수정한다.

```powershell
# 원본 Git 최상위에서 문서 적용/커밋한 다음 실행
$original = Join-Path $HOME 'choi-bujang-secret-vault'
$base = '36c7f03ecd9402b0401e8295502aaf8765b86f04'
$final = (git -C $original rev-parse HEAD).Trim()
$final
# 설명서/README/증거만 바뀌었는지 확인. 아래 실행 파일 경로 변경이 있으면 멈추기
$runtimeChanges = @(git -C $original diff --name-only "$base..$final" -- on-client/package.json on-client/src on-client/public on-client/student on-client/tools on-client/.env.example)
$runtimeChanges
if ($runtimeChanges.Count -gt 0) { throw '실행 소스 변경됨: 새 환경 기능 재현을 다시 수행해야 합니다.' }
# 원본 작업 폴더에 미커밋 변경이 없는지 확인
git -C $original status --short
```

**그다음 정확한 제출 SHA를 새로운 별도 폴더에서 재검증한다.** 이미 있는 `repro-22` 폴더를 지우거나 강제로 덮어쓰지 않는다.

```powershell
$repo = 'https://github.com/BoatingDuck/choi-bujang-secret-vault.git'
$finalRepro = Join-Path $HOME 'choi-bujang-secret-vault-repro-22-final'
if (Test-Path $finalRepro) { throw '최종 재현 폴더가 이미 있습니다. 다른 빈 폴더를 선택하세요.' }
git clone --branch main --single-branch $repo $finalRepro
if ($LASTEXITCODE -ne 0) { throw '최종 clone 실패' }
git -C $finalRepro checkout --detach $final
if ($LASTEXITCODE -ne 0) { throw '최종 checkout 실패' }
if ((git -C $finalRepro rev-parse HEAD).Trim() -ne $final) { throw '커밋 불일치' }
Test-Path (Join-Path $finalRepro 'on-client/docs/RELEASE_REPRODUCTION_22.md')
Test-Path (Join-Path $finalRepro 'on-client/docs/reproduction-evidence/22-13-identity.png')
# 다른 앱이 5189를 점유한다면 종료/강제 점유 해제하지 말고 먼저 확인
```

최종 clone의 `on-client`에서 21단계 실행 명령·브라우저·종료·재실행을 다시 확인하고 **실제 결과를 사용자 관찰로 따로 기록**한다. 이전 clone에서 성공했다고 새 최종 SHA의 실행까지 자동으로 성공 처리하지 않는다. 최종 실행 확인 이전에 제출하거나, 서로 다른 SHA의 통과 결과를 한 SHA의 전체 운영 성공으로 합산하지 않는다.

제출은 방어전 상황실 **22단계 과제 화면**에 저장소 URL과 해당 **40자리 최종 커밋**을 직접 입력한다. 13~20단계용 「포털 제출 준비」는 사용하지 않는다. 저장소를 공개로 바꾸지 않으며 비공개인 경우만 공식 `student-source-cli.mjs` 안내에 따라 원문 JSON을 만들고 제출한다. 제출 접수·원문 전달·AI 원문 검토 통과는 서로 다른 상태다.

## 8. 미완료·확인 불가·지원 범위

- **미완료/UNV:** 19단계 실제 보안 조치 원천 집행과 적용 효과 관측, 운영 자격·SDP 연결 및 동일 최종 소스의 전체 운영 기능 검증.
- **미확인:** 실제 사용자·기기·세션과 접근 판정, XDR 사건 조회/상세, AI 인증·유료 사건 설명, OSV 온라인 조회, 외부 데이터 백업/복원, 최종 문서 추가 커밋의 재현 확인, 22단계 공식 제출·판정.
- **검증됨(관찰 범위 한정):** `36c7f03…`의 새 폴더 clone/checkout, Node/npm/PowerShell 버전, 앱 `0.2.19`, 필수 파일, 로컬 시작/브라우저/중지/재시작, 13~20 표시 함수의 오류·대기·미실행 상태, 로컬 도움정보의 진단 코드.
- **하지 않은 일:** demo 데이터로 운영 검증 주장, 본인 외 기록 조회, 비밀 복제, 제공 서버/인증·판정 코드 수정, 유료 AI 요청, 실제 조치 강제 실행, 데이터베이스 삭제·수정.

**최종 상태:** 이번 릴리스는 **검증 중(UNV), 앱 버전 `0.2.19`**으로 기록한다. 22단계 AI 원문 검토 통과를 받아도 서버가 새 환경에서 실제 실행했다는 인증이나 운영 도입·v1.0 자동 승격을 뜻하지 않는다.
