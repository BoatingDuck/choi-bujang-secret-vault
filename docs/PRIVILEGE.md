# 보너스 XDR-05 — 권한 가로채기 탐지

## 목적과 적용 범위

최 부장 PC의 수업용 Wazuh 경보(`xdr/fixtures/privilege.json`)를 읽어, 계정·그룹 변경과 관리자 권한 사용 중 명확한 권한 악용 정황만 차단 **후보**로 분류한다. 기존 `src/decider.mjs` / ZTNA 결정 계약 / 기존 규칙은 수정하지 않는다.

**중요:** 이 저장소의 XDR 실행기는 `decide.mjs`만 읽어서 로컬 판정 결과를 만든다. `respond.mjs`는 별도로 실행해야 하며, 실제 운영 엔진의 세션을 종료하지 않고 검증되지 않은 오프라인 거부 후보를 만든다. 실제 세션 회수는 엔진이 검증한 계정·세션 식별자를 매핑하고 신뢰할 수 있는 정책 연결부가 추가돼야 한다. 출발 주소나 경보의 `srcuser`만으로 운영 세션을 식별하지 않는다.

## 이어받기 상태

- GitHub `main`의 검토 시점 커밋: `6360cb279e2fe0423e15a1b362a447fc0ca92e79` (보너스 xdr-04 저장점).
- 기존 규칙은 `src/decider.mjs`의 `RULE_IDS` (`device_registered`, `step_up_required`, `resource_zone`) 및 `decide(request)` 본문에서 읽힌다.
- `docs/DECIDER_REQUEST.md`는 그 판정기의 18개 입력·5개 출력 계약이다. 권한 경보를 그 계약에 임의로 추가하지 않는다.
- `scripts/xdr-run.mjs`는 `xdr/fixtures/privilege.json`을 읽고 `xdr/privilege/decide.mjs`를 호출한다.
- 로컬 `git status`는 사용자 컴퓨터에서 직접 확인해야 한다. ZIP이 현재 상태를 검증하지는 못한다.

## 제작 내용

1. `xdr/privilege/read-alerts.mjs`는 경보당 시각·출발 주소·계정·수준·설명만 읽는다. 계정 이름은 제공된 가상 계정 형식 외에는 가리고, 민감 문자열처럼 보이는 내용은 가린다. `decide.mjs`는 이 모듈을 불러오지 않는다.
2. `xdr/privilege/patterns.json`에는 9개 패턴(강한 신호 8가지와 검토 신호 1가지)과 각각 한 줄짜리 근거를 담는다.
3. `xdr/privilege/decide.mjs` 상단에는 JSON의 패턴을 상수로 복사했으며, 이 단일 파일의 `decide(alert)`는 `{action, confidence, reason}`만 반환한다. import, 파일 I/O, 외부 호출은 없다.
4. `xdr/privilege/respond.mjs`는 차단 후보만 `deny-rules.json`에 기록한다. 각 후보에는 `targetAccount`, `sourceIp`, `expiresAt`, `evidenceAlertId`, 근거가 포함되며 **실제 운영 정책에 자동 적용되지 않는다.** 로그에는 원문 명령·계정 이름·토큰·IP 대신 이벤트 번호와 분류를 쓴다. `record`는 거부 규칙이나 경고 로그에 추가하지 않는다.
5. `self-test.mjs`는 26건 분류, 확신도 경계, 패턴 근거, ID 독립성, 정상 이벤트 오차단, 계정·출발지 범위, 만료 시간 및 과거 정상 이벤트와의 충돌을 확인한다.

## 패턴 근거

- [MITRE ATT&CK T1078 — Valid Accounts](https://attack.mitre.org/techniques/T1078/): 기존/정상 계정을 탈취·악용하여 관리자 접근을 확대할 수 있다. 관리자 그룹 변경과 관리자 권한 사용의 비정상 연쇄를 분류한다.
- [MITRE ATT&CK T1068 — Exploitation for Privilege Escalation](https://attack.mitre.org/techniques/T1068/): 소프트웨어 취약점 악용에 의한 권한 상승 기술이다. **T1068 태그나 관리자 명령 하나만으로 취약점 악용의 사실이 입증되지는 않는다.** 이 과제의 경보는 복합적인 관리자 사용 이상 징후를 나타내며, 익스플로잇 실행 증거까지 포함하지 않는다.

## 실행: 프로젝트 루트 PowerShell

```powershell
node .\xdr\privilege\read-alerts.mjs
node .\xdr\privilege\self-test.mjs
npm.cmd run xdr:run -- privilege
node .\xdr\privilege\respond.mjs
npm.cmd run decider:test
npm.cmd run fixture:7
npm.cmd run detect:test
```

예상되는 로컬 수업용 경보 분류: `block=9`, `alert=8`, `record=9`, 정상 `block=0`. `respond` 실행 시 거부 후보 9건과 알림 17건이 예상된다. 이는 **로컬 실습 결과**이며 공식 심판 점수나 실제 세션 회수 증거가 아니다. `respond`를 여러 번 실행하면 `xdr/alerts.log`에 중복 로그가 쌓일 수 있으니 한 번 실행하고 확인한다.

원본 `xdr/fixtures/privilege.json`은 그대로 둔다. `result.json`과 `deny-rules.json`은 위 명령으로 생성한다.

## 오차단 방지 원칙

- 단일 관리자 명령·그룹 목록 조회·취소된 상승 창·과제용 그룹 추가만으로 `block`하지 않는다.
- 그룹 이름이 `administrators`가 아니면 관리자 그룹 추가 패턴과 일치시키지 않는다.
- `decide.mjs`는 경보 ID를 정답표처럼 사용하지 않고, 수준·MITRE 태그·설명·그룹·반복 등의 실제 필드만 판단한다.
- `respond.mjs`는 검증된 형식의 가상 계정과 출발 주소 조합으로 후보 범위를 제한한다. 같은 조합에 정상 `record`가 있다면 그 조합의 거부 후보는 생략한다.
- `targetAccount`·`sourceIp`만으로 신뢰할 수 있는 세션 ID가 확보되지 않으므로 자동 회수는 하지 않는다. 정상 사용자의 다른 접속을 묶어서 중지하지 않는다.

## 제출 전 점검

`npm.cmd run xdr:run -- privilege`를 다시 실행하여 결과를 최신화한다. `git status`, `git diff --check`, `git diff --cached --check`를 확인하고 `README.md`, `docs/PRIVILEGE.md`, `xdr/privilege/`, `xdr/alerts.log`만 스테이징한다. 변경 목록에 다른 과제의 파일·비밀값·실명·메모 본문·`bundle-notes.json`·`artifacts/submission.json`이 없어야 한다.

커밋 제목: **보너스 xdr-05 저장점**. 푸시와 포털 제출 및 공식 판정은 학생이 실제 실행하고 확인한다.
