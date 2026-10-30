# 내 보안 Agent 시작 틀 0.2.19

이 보안 Agent는 회사 직원이 자기 로그인 상태, 업무 앱 접속 결과, 최근 접속 기록과 보안 경보를 보는 보안 앱입니다. 13단계부터 22단계까지 이 프로젝트 하나로 화면을 채워 가며 완성합니다. 처음이라면 docs/GETTING_STARTED_STUDENT.md부터 읽습니다. 무엇을 왜 만드는지와 단계별 순서가 그 문서에 있습니다.

이 시작 틀을 받은 것만으로 단계를 통과하지 않습니다. 단계마다 docs/STUDENT_PROMPTS.md의 안내를 수업용 AI에 붙여 넣어 student/extension.mjs를 고치고, 화면에서 확인하고, 커밋한 뒤 ALEPH에 제출합니다. 제출하면 서버가 그 커밋의 코드를 받아 AI가 단계 과제 기준으로 읽고 판정합니다. 코드를 실행해서 판정하지 않습니다.

## 켜기

검수 환경은 Node.js 24.19.0이며 외부 npm 의존성이 없습니다. 이 폴더의 PowerShell에서 아래를 실행하고 PC 브라우저로 http://127.0.0.1:5189 를 엽니다. 자세한 켜기·끄기·다시 켜기는 docs/STUDENT_LAUNCH_GUIDE.md에 있습니다.

    powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1

npm start도 같은 서버를 켭니다. 기본 실행은 실제 회사 시스템(기존 엔진)에 연결되지 않은 상태입니다. npm run demo는 예제 자료로 화면을 보여 줄 뿐이며 실제 연결이나 성취가 아닙니다. npm run check는 student/extension.mjs의 문법만 확인합니다.

## 지킬 것

- 기존 1~3차 프로젝트와 학생 파일은 지우거나 덮어쓰지 않습니다. 새 폴더에서 시작하거나, 이미 하던 프로젝트를 이어 씁니다.
- AI 열쇠·비밀번호·토큰을 코드, 커밋, 캡처, 도움정보에 넣지 않습니다. 주소나 열쇠를 직접 입력하는 칸도 만들지 않습니다.
- .env.example에는 비밀 없는 설정만 있습니다.

## 더 읽을 곳

- 단계별 안내와 AI에 붙여 넣을 문장: docs/STUDENT_PROMPTS.md
- 단계별 확인 항목: docs/CURRICULUM.json, docs/IMPLEMENTATION_CONTRACT.md
- 오류 코드별 해결: docs/CONNECTION_TROUBLESHOOT.md
- 시작 틀 업데이트(내 파일 보존): docs/STARTER_UPDATE.md
- 실제 회사 시스템(SDP)·앱 안 AI 연결은 담당자가 따로 안내할 때만 씁니다: docs/SDP_HOST_CONNECTION.md, docs/AI_SETUP_GUIDE.md. 이 연결은 앱을 처음 켜고 13~16단계 화면을 만들거나 공식 AI 코드 판정을 받기 위한 전제 조건은 아닙니다. 다만 17단계 이후의 실제 연결과 새 환경 재현은 해당 단계의 기준에 따라 따로 확인합니다.

## 21단계 학생 작성: 은셰브 실행 설명서

- **목적:** 사용자·기기·세션 상태와 업무 앱 접근 판정, 본인 범위 XDR 기록, AI 설명·조치 결과, 패키지 취약점 조회 상태를 제공하는 교육용 로컬 보안 Agent. 실제 연결·조치 효과는 해당 운영 원천의 확인 결과와 구분합니다.
- **기능과 구조:** 브라우저(`http://127.0.0.1:5189/`) → `src/server.mjs`(로컬 HTTP/API) → `src/engine.mjs`·`student/engine-adapter.mjs`(접근 제어·XDR 연결 경계) / `src/ai/`·`src/connection/`(AI 게이트 연결 경계). `public/app.js`가 상태를 수집해 `student/extension.mjs`의 학생 표시 함수를 호출합니다. 연결·조치·AI 요청은 운영 설정/권한이 있는 경우에만 수행합니다.
- **지원 환경/버전:** Windows PowerShell 실행 도구 `tools/start-alekov.ps1`; 앱 `package.json` 버전 `0.2.19`, `engines.node`는 `24.19.0`(실행 도구는 Node 22~24 허용). 학생 PC 실측 버전 및 실제 재현 여부는 별도 확인해야 합니다. 기본 상태는 실제 외부 시스템과 미연결이며 `-Demo`는 예제입니다.
- **실행 설명서·글로 쓴 Mermaid 구성도·경계·오류별 확인:** [docs/STUDENT_RUNBOOK.md](docs/STUDENT_RUNBOOK.md). 기존 제공 문서와 실행 파일은 보존합니다.
## 22단계 학생 작성: 은셰브 새 환경 재현 및 릴리스 기록

- **학생 재현 기록:** [docs/RELEASE_REPRODUCTION_22.md](docs/RELEASE_REPRODUCTION_22.md) (별도 폴더 clone/커밋·환경·버전·13~21단계 UI 관찰·미확인·백업/복원 계획·화면 근거).
- **현 릴리스:** 앱 버전 `0.2.19`, 검증 중(UNV), **v1.0 또는 운영 인증 아님**. `-NoNativeHost`의 로컬 UI/오류 표시 재현과 실제 SDP/XDR/AI/OSV 연결·실집행을 구분합니다. 최종 제출 SHA는 커밋 후 별도 폴더 재검증 및 `git rev-parse HEAD`로 확인합니다.
