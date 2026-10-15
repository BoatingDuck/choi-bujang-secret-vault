# 보너스 XDR-06 — 자료 빼돌리기 탐지

## 이어받기 (5줄)
1. `src/decider.mjs`의 `RULE_IDS`는 `device_registered`, `step_up_required`, `resource_zone`이며 요청 계약은 `docs/DECIDER_REQUEST.md`에 있다.
2. 이 판정기는 `request.deviceRegistered`, 자원 경로, 가상 `signals/recentEvents`를 직접 검사하며 외부 JSON 규칙을 읽지 않는다.
3. `xdr/`은 별도 탐지 모듈과 교육용 Wazuh 경보를 담으며 `scripts/xdr-run.mjs`가 `xdr/<key>/decide.mjs`를 불러 결과를 작성한다.
4. XDR-06은 `xdr/fixtures/exfiltration.json`을 읽되 원본을 수정하지 않고, `xdr/exfiltration/decide.mjs` 단독으로 판정한다.
5. GitHub `main` 기준 착수 커밋은 `1e9c0c9`(XDR-05)이며 로컬 작업 트리 상태는 학생 PC에서 `git status`로 별도 확인해야 한다.

## 구현
- `read-alerts.mjs`: 시각·출발 주소·계정·규칙 수준·설명만 출력. 토큰/키·URL·이메일 등 보일 수 있는 비밀값 제거. decide에서 사용하지 않음.
- `patterns.json`: 각 패턴의 이름, 찾는 조건, 한 줄 근거. MITRE ATT&CK T1041(기존 C2 채널 유출) / T1048(대체 프로토콜 유출).
- `decide.mjs`: patterns 리터럴을 파일 상단에 복사하고 imports/I/O 없이 경보별 `{ action, confidence, reason }` 반환. 0.85 이상 block, 0.5 이상 alert, 나머지 record.
- 50,000,000 bytes 기준은 이번 교육용 경보에서만 사용하는 보수적 휴리스틱이며 **보편적인 보안 임계값이 아니다**. 명확한 위험은 고위험 경보, 실제 목적지, 충분한 전송량, 이상 정황의 결합으로 판단한다.
- `respond.mjs`: **운영 ZTNA 정책을 직접 바꾸지 않는 오프라인 목적지 차단 후보** `deny-rules.json` 생성. 각 규칙에는 만료 시각·근거 경보 ID를 포함하고, 정상 이벤트가 관찰된 목적지는 전역 차단 후보에서 제외한다. 출발 IP나 계정 전체를 차단하지 않는다.
- 알림은 `xdr/alerts.log`에 사건 ID와 이유만 한 줄 JSON으로 추가. 실제 데이터·계정·주소는 로그에 기록하지 않는다.

## 테스트 / 실행
```powershell
node .\xdr\exfiltration\read-alerts.mjs
node .\xdr\exfiltration\self-test.mjs
npm.cmd run xdr:run -- exfiltration
node .\xdr\exfiltration\respond.mjs
npm.cmd run decider:test
npm.cmd run fixture:7
npm.cmd run detect:test
```

실습 원본 기준 예상: 경보 30/추출 30, block 10, alert 10, record 10, 정상 차단 0, 거부 후보 10, 알림 20.
로컬 시험은 **공식 심판 판정이나 실제 운영 정책 차단/회수를 증명하지 않는다**.

## 제출 전 점검
- 원본 `xdr/fixtures/exfiltration.json`, `src/decider.mjs`, `aleph.config.json`은 바꾸지 않는다.
- `git diff --check` / `git diff --cached --check` 및 변경 목록과 비밀값 유출 여부 점검.
- `npm.cmd run xdr:run -- exfiltration` 재실행 후 `보너스 xdr-06 저장점` 커밋.
- `bundle-notes.json`, `artifacts/submission.json` 커밋 금지.

## 근거
- https://attack.mitre.org/techniques/T1041/
- https://attack.mitre.org/techniques/T1048/
