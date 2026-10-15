# 보너스 XDR-04 — 몰래 심어진 프로그램 탐지

## 이어받기 (2026-10-15 main 기준)

- 기존 AGENTS.md는 파일 변경 범위를 최소화하고 실제 실행하지 않은 심판 결과를 주장하지 않도록 지시한다.
- README.md는 이전 단계 및 보너스 작업 기록을 보존한다. 이번 모듈은 추가 섹션만 기록한다.
- 기존 ZTNA 정책 판정기는 `src/decider.mjs`의 `RULE_IDS`와 `decide(request)`로 자체 규칙을 읽는다.
- `xdr/fixtures/persistence.json`은 24건의 가상 Wazuh 경보이고, `scripts/xdr-run.mjs`가 독립 `xdr/persistence/decide.mjs`를 직접 호출한다.
- `main`에서 확인한 이전 보너스 커밋은 `143485d`였다. 로컬 `git status`는 학생 PC에서 별도로 확인해야 한다.

## 구현 범위

| 파일 | 역할 |
|---|---|
| `xdr/persistence/read-alerts.mjs` | 원본 경보 비변경, 시간/IP/계정/수준/설명만 안전하게 추출 |
| `xdr/persistence/patterns.json` | 조건 및 MITRE 근거 7개 |
| `xdr/persistence/decide.mjs` | 오프라인 독립 `decide(alert)` 분류, import 및 I/O 없음 |
| `xdr/persistence/respond.mjs` | 고확신 차단만 `deny-rules.json`에 만료 후보로 기록하고 알림을 `xdr/alerts.log`에 추가 |
| `xdr/persistence/self-test.mjs` | 24건 분류, 형태/확신도/사유, 정상 이벤트, 공유-IP 보호 확인 |

## 탐지의 근거

- 서비스 생성·변경: MITRE ATT&CK T1543.003 (Windows Service) — https://attack.mitre.org/techniques/T1543/003/
- 예약 작업: MITRE ATT&CK T1053.005 (Scheduled Task) — https://attack.mitre.org/techniques/T1053/005/
- 시작 폴더: MITRE ATT&CK T1547.001 — https://attack.mitre.org/techniques/T1547/001/
- 과제에서 지정한 T1543/T1053은 중심 증거이며, 시작 폴더는 T1547.001이 정확한 세부 분류이다.
- 경보의 ATT&CK 분류 태그·수준·서명 미확인·임시 파일 존재 **하나만으로는 차단하지 않는다**.

## 판단 기준

- `confidence >= 0.85`: block — 의심스러운 자동 실행 메커니즘과 임시 실행 경로·미서명·반복·평소 목록 미등록 등 복합 근거가 있는 경우.
- `0.5 <= confidence < 0.85`: alert — 변화가 있으나 정상 수업/운영 이벤트와 구분되지 않는 경우.
- `confidence < 0.5`: record — 정상 또는 차단할 근거가 없는 이벤트.
- 제공된 24건의 기대 분류: `ps-01`~`ps-08` block 8건, `ps-09`~`ps-16` alert 8건, `ps-17`~`ps-24` record 8건.
- **경보 번호는 로컬 자체 검증에만 사용한다. 실제 `decide.mjs`는 ID나 특정 IP를 조건으로 사용하지 않는다.**

## ZTNA 연결의 범위 및 오차단 방지

- `respond.mjs`가 만드는 `deny-rules.json`은 `{ schema: 'aleph.xdr.deny-proposals.v1', rules: [...] }` 형태의 **오프라인 정책 제안**이다. 각 제안은 `action`, `sourceIp`, `targetAgentName`, `evidenceAlertId`, `expiresAt`, `reason`을 가진다.
- 기본 만료 시간 15분, 허용 범위 1~60분이다. **같은 출발 IP에서 정상 `record` 경보도 관측된 경우 해당 IP에 대한 전체 거부 후보는 생성하지 않는다.**
- `agent.name`은 경보에 적힌 호스트 이름일 뿐 ZTNA 계약상 검증된 기기 ID가 아니다. `srcip`도 검증된 `deviceId`가 아니다.
- 따라서 안전한 격리 적용에는 운영 엔진이 검증한 기기 식별자와 별도의 연동 계약이 필요하다. 이번 파일은 정책 심판이나 실제 운영 접속을 직접 차단하지 않는다.
- 기존 `src/decider.mjs`, 기존 `RULE_IDS`, `docs/DECIDER_REQUEST.md`, `aleph.config.json`, API, 기존 XDR 모듈을 변경하지 않는다.
- 원본 경보와 계정명·실행 경로·원격 페이로드·비밀번호는 판정 로그에 출력하지 않는다. 읽기 모듈은 가상 계정 식별자만 허용하고 설명에 비밀값처럼 보이는 표현은 가린다.
- `xdr/alerts.log`는 `respond.mjs` 실행 때마다 append 된다. 중복 방지를 위해 실제 응답 생성은 한 번 실행하고 반복 검증은 `npm run xdr:run`으로 수행한다.

## 학생 PC 실행 (PowerShell / 저장소 루트)

```powershell
git status
node .\xdr\persistence\read-alerts.mjs
node .\xdr\persistence\self-test.mjs
npm.cmd run xdr:run -- persistence
node .\xdr\persistence\respond.mjs
npm.cmd run decider:test
npm.cmd run fixture:7
npm.cmd run detect:test
```

검증 출력은 `경보 24건 / 추출 24줄`, `PASS: ... block=8 alert=8 record=8 / 정상 block=0`, `{"proposedBlocks":8,"alertsLogged":16}`가 기대된다. 독립 실행 후 `xdr/persistence/result.json`과 `xdr/persistence/deny-rules.json`이 생성된다.

실제 결과를 확인한다.

```powershell
$r = Get-Content .\xdr\persistence\result.json -Raw | ConvertFrom-Json
$r.counts
@($r.decisions | Where-Object { $_.alertId -match '^ps-(1[7-9]|2[0-4])$' -and $_.action -eq 'block' }).Count
$d = Get-Content .\xdr\persistence\deny-rules.json -Raw | ConvertFrom-Json
$d.rules.Count
```

`8/8/8`, 정상 차단 수 `0`, 후보 수 `8`이면 기대 결과다. 경보가 변경되면 다시 검토한다. 이 예측은 공식 심판 판정이 아니다.

## 저장점과 제출

- 기존 README 내용은 유지하고 `## 보너스 XDR-04` 절만 추가한다.
- `npm.cmd run xdr:run -- persistence`를 다시 실행해 결과를 갱신한다.
- `git status`, `git diff --check`, `git diff --cached --check` 확인, 다른 작업을 실수로 스테이징하지 않는다.
- `README.md`, `docs/PERSISTENCE.md`, `xdr/persistence/` 및 이번 실행에서 추가된 `xdr/alerts.log`만 커밋한다.
- 비밀번호, 토큰, 실제 개인정보, `bundle-notes.json`, `artifacts/submission.json`은 포함하지 않는다.
- 커밋 메시지: `보너스 xdr-04 저장점`.
- 심판의 실제 평가와 실 서비스 정책 적용은 이 로컬 시험과 별개이다.
