# 21단계 | 은셰브 학생용 실행 설명서와 시스템 구성도

- **작업일:** 2026-10-29
- **보안 Agent:** 은셰브
- **작업 유형:** 실행·구성·오류 대응 문서화 (기존 앱 기능 변경 없음)
- **작성 파일:** `on-client/docs/STUDENT_RUNBOOK.md` (신규)
- **수정 파일:** `on-client/README.md` (기존 내용 유지, 21단계 학생 작성 섹션 추가)
- **학생 구현 함수:** 이번 단계에서 수정하지 않음 (`on-client/student/extension.mjs` 보존)
- **구현·문서 커밋:** [`f84b6f26c07861dcc003138ca172c5308e320632`](https://github.com/BoatingDuck/choi-bujang-secret-vault/commit/f84b6f26c07861dcc003138ca172c5308e320632)
- **GitHub 반영:** `main` 브랜치 푸시 완료 (사용자 PowerShell 출력으로 확인)
- **공식 제출·판정:** **미확인** (이번 기록 작성 시점에 제출·통과 결과를 전달받지 않음)

## 작업 목표

21단계의 목표는 다른 사람이 **실제 프로젝트 위치와 명령을 확인하면서 은셰브를 직접 실행할 수 있도록** 설명서를 작성하는 것이었다. 이전 단계에서 구현한 기능을 다시 만드는 작업이 아니라, 현재 소스의 설치·실행 경로, 학생 작성 부분과 제공 코드의 경계, 데이터 흐름, 장애 대응 방법을 검증 가능한 문서로 정리했다.

제공 문서를 덮어쓰지 않도록 `docs/STUDENT_RUNBOOK.md`를 별도로 만들고, 기존 `README.md`에는 문서로 연결되는 학생 작성 섹션만 추가했다. 보안 시스템이나 AI 게이트의 **연결 여부와 서버 프로세스의 실행 성공을 같은 의미로 기록하지 않는 것**을 기준으로 삼았다.

## 구현 전에 확인한 현재 코드와 실행 계약

GitHub의 기존 `main` 소스와 이전 문서를 읽고 다음 항목을 대조했다.

| 확인 대상 | 확인한 내용 |
| --- | --- |
| 저장소 최상위 | `choi-bujang-secret-vault/`; Git 커밋·푸시는 이 위치에서 수행 |
| 앱 폴더 | `on-client/`; 로컬 앱 실행 명령을 실행하는 위치 |
| `on-client/package.json` | 앱 버전 `0.2.19`, `engines.node` `24.19.0`, `start`·`demo`·`check`·`package-app` 스크립트 |
| `tools/start-alekov.ps1` | 폴더·Node 버전·포트 검사 후 로컬 서버 실행, 기본 포트 `5189`, `-NoNativeHost` 지원 |
| `src/server.mjs` | `127.0.0.1`에서 로컬 HTTP 서버 및 API 제공 |
| `public/index.html`, `public/app.js` | 제공 탭·카드·버튼과 학생 함수 호출 |
| `student/extension.mjs` | 기존 13~20단계 학생 표시 함수 8개 보존 |
| `.env.example` 및 연결 모듈 | 공개 가능한 설정 키 이름과 SDP·AI·조치·OSV 연동 경계 확인 |

**이름 구분:** 학생 Agent 이름은 `은셰브`지만 제공 실행 도구와 일부 기본 화면 문구에는 `케셰브`가 남아 있다. 실제 실행 파일명과 제공 코드를 임의로 바꾸지 않고 설명서에 구분해 적었다.

## 작성한 문서와 구성도

### 1. 실행 절차

`STUDENT_RUNBOOK.md`에 작업 폴더 구조, Windows PowerShell 여는 위치, Node.js·npm·PowerShell 버전 확인, 실행·종료·재실행 순서, `http://127.0.0.1:5189/` 접속 주소, 정상 시작 신호를 작성했다.

실제로 사용한 **연결 설정 없는 로컬 화면 확인 명령**은 다음과 같다.

```powershell
Set-Location "$HOME\choi-bujang-secret-vault\on-client"
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1 -NoNativeHost
```

`-NoNativeHost` 실행은 로컬 앱 표시 확인용이며, 계정 인증·SDP 연결·AI 게이트의 실제 연결 확인이 아니다. 기본 실행 명령, `npm.cmd start`, 예제 모드 `-Demo`와의 차이도 별도로 문서화했다.

### 2. 글로 작성한 시스템 구성도

문서의 Mermaid와 텍스트 설명에 **브라우저 → `src/server.mjs` 로컬 앱 서버 → 접근 제어·XDR 연결 경계 / AI 게이트 연결 경계**를 명시했다.

- 제공 `public/app.js`가 API 상태를 읽고 `student/extension.mjs`의 표시 함수를 호출한다.
- 접근 제어와 XDR 기록은 제공 엔진 및 승인된 SDP 호스트에 의존한다. 기본 실행은 미연결이다.
- AI 연결·점검·사건 설명은 제공 AI 연결 모듈과 게이트 권한 확인에 의존한다.
- 보안 조치와 OSV 패키지 조회는 별도 설정·승인 조건이 있어야 하며, 요청 접수·결과 불명·실제 효과를 구분한다.

이미지 파일에만 의존하지 않고 **Mermaid 코드와 글로 된 관계 설명**을 함께 남겼다.

### 3. 학생 코드와 제공 코드의 경계

기존 `createStudentView()`의 표시 함수 8개를 문서의 표에 정리했다.

`renderIdentity`, `renderDecision`, `renderEvents`, `renderStatus`, `renderAiConnection`, `renderExplanation`, `renderAction`, `renderVulnerabilities`

각 함수의 입력 필드와 표시 책임을 기존 코드와 비교했다. 학생 함수는 이미 전달받은 데이터를 그리며, 제공 서버의 인증·접근 판정·AI 요청·보안 조치를 직접 실행하는 기능으로 설명하지 않았다.

### 4. 오류·미확인 상태 구분

실행 위치 오류, Node 버전 오류, 포트 충돌, `ENGINE_NOT_CONNECTED`, AI 연결 오류, `ACTION_UNSUPPORTED`, 취약점 조회의 `not_configured`·`not_checked`·`partial` 등 상태별 확인 순서를 정리했다.

특히 **조회하지 않음 ≠ 취약점 없음**, **서버 실행 성공 ≠ 외부 보안 시스템 연결 성공**, **조치 요청 접수 ≠ 보안 효과 확인** 원칙을 유지했다. 비밀 키·토큰·비밀번호·인증 설정값은 문서에 기록하지 않았다.

## 작업 도중 발생한 문제와 해결

| 발생 상황 | 확인한 원인 | 대응 및 결과 |
| --- | --- | --- |
| 첫 ZIP 압축 해제 실패 | 다운로드 폴더 안의 대상 경로에 같은 파일이 이미 존재 | 수정 ZIP은 새로운 임시 폴더에 압축을 풀도록 변경해 충돌 회피 |
| 첫 `apply-stage21.ps1` 실행 실패 | Windows PowerShell 5.1에서 한글 문자열이 깨져 `ParserError` 발생 | PowerShell 5.1 인코딩을 고려해 스크립트를 수정하고 재배포 |
| 수정 스크립트 재실행 | `21-stage-runbook-kit-v2.zip` 사용 | `STUDENT_RUNBOOK.md` 추가와 기존 README 학생 섹션 추가 완료 확인 |
| 실측 기록 보완 | 최초 문서는 소스만 대조한 상태여서 실제 PC 실행 결과를 주장할 수 없었음 | 사용자 PC에서 실행·화면·종료·재실행을 확인한 후 별도 실측 기록란에 반영 |

이 문제 해결은 **문서 생성·적용 도구**에 대한 수정이다. 은셰브의 제공 서버, 기존 학생 기능, 인증 설정을 고쳐서 해결한 것이 아니다.

## 사용자 PC에서 직접 확인한 내용

| 확인 방법 | 실제 관찰 결과 | 확인 수준 |
| --- | --- | --- |
| 버전 확인 | Node.js `v24.19.0`, npm `11.17.0`, Windows PowerShell `5.1.26100.9711` | 사용자 PowerShell 출력 확인 |
| 문서 적용 | `21단계 문서를 추가했고 기존 README 끝에 학생 작성 섹션을 붙였습니다.` | 사용자 PowerShell 출력 확인 |
| 앱 시작 | `start-alekov.ps1 -NoNativeHost` 실행 후 정상 시작 안내 출력 | 사용자 직접 확인 |
| 브라우저 접속 | `http://127.0.0.1:5189/`에서 앱 화면 정상 표시 | 사용자 직접 확인 |
| 보호 현황 | 「현재 로그인」 카드와 학생 `renderIdentity` 표시 확인 | 사용자 직접 확인 |
| 서버 종료 | 실행 PowerShell에서 `Ctrl+C` 후 브라우저 `ERR_CONNECTION_REFUSED` | 사용자 제공 화면으로 확인 |
| 서버 재실행 | 같은 명령으로 실행 후 브라우저 화면 다시 열림 | 사용자 직접 확인 |
| Git 변경 점검 | `git diff --cached --check` 이상 없음, 수정 범위 2개 파일 | 사용자 PowerShell 출력 확인 |
| Git 커밋·푸시 | 2개 파일, 총 239줄 추가; `f84b6f2` 커밋으로 `main` 푸시 | 사용자 PowerShell 출력 확인 |
| Git 작업 트리 | `git status --short` 출력 없음 | 사용자 PowerShell 출력 확인 |
| 실제 SDP/XDR 연동 | 실제 운영 서버·보안 기록 전달 검증 | **이번 단계 미확인** |
| 실제 AI 게이트·보안 조치 | 유료 AI 요청·실제 보안 조치·효과 관측 | **이번 단계 미실행** |
| 실제 OSV 외부 조회 | 새 공개 취약점 조회 성공 여부 | **이번 단계 미확인** |
| 공식 21단계 제출·판정 | 서버 AI 원문 검토의 승인·통과 상태 | **미확인** |

실제 브라우저에서 카드가 표시된 사실과 **그 카드가 나타내는 외부 데이터 연결 성공**은 구분했다. 또한 해당 단계의 서버 AI는 제출 커밋의 원문 일치 여부를 읽어 판단하며, 서버에서 문서의 실행 명령을 실행해 검증하는 것은 아니다.

## 커밋 및 기록 보존

21단계 파일은 기존 소스나 개발 로그를 덮어쓰지 않고 **하나의 커밋**으로 기록했다.

```text
커밋: f84b6f26c07861dcc003138ca172c5308e320632
메시지: 21단계: 은셰브 실행 설명서 및 시스템 구성도 작성
변경:
  on-client/README.md               (+7줄)
  on-client/docs/STUDENT_RUNBOOK.md (+232줄, 신규)
결과: 2 files changed, 239 insertions(+)
브랜치: main (push 확인)
```

`student/extension.mjs`, `public/app.js`, `src/server.mjs`, 기존 인증 설정과 이전 단계 기록은 이번 커밋에서 변경하지 않았다. 새 개발일지인 **현재 파일은 위 구현 커밋에 포함되지 않으며**, 개발 기록용 별도 커밋으로 저장한다.

## 정리 및 다음 작업

이번 단계에서는 기능을 더 만드는 것보다 **다른 사람이 동일한 실행 위치와 명령을 따라 앱을 시작하고, 확인된 결과와 미확인 연결을 구분할 수 있도록 하는 것**에 집중했다. PowerShell 실행부터 브라우저 접속, 종료와 재실행까지 직접 확인한 뒤 문서에 결과를 남겼다.

남은 작업은 21단계 공식 제출 상태 및 AI 검토 결과를 확인해 이 기록에 사실대로 반영하고, **22단계에서 요구하는 새 폴더 재현을 별도로 수행**하는 것이다. 21단계의 기존 폴더 재실행을 22단계 새 설치 재현으로 간주하지 않는다.
