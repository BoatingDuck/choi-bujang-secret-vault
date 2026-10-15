# 보너스 XDR-03 — 알려진 취약점 악용(Log4Shell) 탐지

## 설계 요약

- **입력:** `xdr/fixtures/known-cve.json`의 수업용 Wazuh 모양 경보 24건. 원본은 고치지 않는다.
- **읽기:** `xdr/known-cve/read-alerts.mjs`는 시각·출발 IP·계정·경보 수준·설명만 내보내며 비밀값으로 보이는 문자열은 제거한다. `decide.mjs`와 분리되어 있다.
- **근거:** NIST NVD CVE-2021-44228의 JNDI 원격 조회 위험과 MITRE ATT&CK T1190. `patterns.json`의 각 항목은 이름·조건·한 줄 근거를 포함한다.
- **판정:** 독립 `decide(alert)`는 요청 데이터에서 완성된 원격 JNDI 조회를 확인하면 block(0.98), 불완전한 JNDI 구문은 alert(0.72), T1190 수준 5 이상 + 취약점 정황 또는 약한 태그는 alert(0.62/0.53), 나머지는 record(0.1)로 분류한다. `confidence`는 실제 확률이 아니라 수업용 규칙 확신도다.
- **알림·거부 후보:** `respond.mjs`는 `block`이고 확신도 0.85 이상인 경보에 한해 `deny-rules.json`에 만료 시각·근거 경보 ID가 들어간 단기 IP 거부 **후보**를 쓴다. 관찰된 정상 요청과 동일 IP이면 후보 생성을 건너뛴다. 차단·알림 경보의 메타데이터만 `xdr/alerts.log`에 덧붙인다. 원본 요청과 비밀값은 기록하지 않는다.
- **기존 판정기:** `src/decider.mjs`, `docs/DECIDER_REQUEST.md`와 기존 ZTNA 규칙은 수정하지 않는다. 현재 `scripts/xdr-run.mjs`는 `decide.mjs`만 호출하며 `respond.mjs`는 호출하지 않는다. 생성된 deny-rules.json은 **활성 정책에 자동 적용되지 않는 오프라인 제안 파일**이다.

## 실행(저장소 루트, Windows PowerShell)

```powershell
node .\xdr\known-cve\read-alerts.mjs
node .\xdr\known-cve\self-test.mjs
npm.cmd run xdr:run -- known-cve
node .\xdr\known-cve\respond.mjs
Get-Content .\xdr\known-cve\result.json -Raw | ConvertFrom-Json | Select-Object -ExpandProperty counts
```

`self-test.mjs`는 파일을 쓰지 않고 24건 분류, 정상 요청 차단 0건, 확신도 기준, 패턴 근거, IP 중복 안전성을 검증한다. `xdr:run`은 24건 판정 결과를 `result.json`으로 만들고, `respond.mjs`는 `deny-rules.json`을 생성하고 `alerts.log`에 메타데이터만 기록한다.

## 수업용 경보 예상 결과

- `block` 8건 (`kc-01` ~ `kc-08`)
- `alert` 8건 (`kc-09` ~ `kc-16`)
- `record` 8건 (`kc-17` ~ `kc-24`)
- 정상 요청에 대한 block **0건**

이 수치는 제공된 **고정 24건 경보의 로컬 예측 및 자체 시험** 결과다. 공식 채점 점수, 실제 네트워크 차단 성공이나 CVE 패치 여부를 나타내지 않는다.

## 한계와 안전 수칙

1. JNDI 구문 탐지만으로 오래된 Log4j 의존성을 실제 패치하지 못한다. Log4j는 공식 최신 지원·보안 패치 버전으로 업데이트해야 한다.
2. 현재 ZTNA 실제 요청 계약에는 임의 IP 차단 후보를 반영하는 공식 필드가 없으며, 오프라인 후보를 자동 적용해서는 안 된다. 특히 NAT/공유 IP는 정상 사용자 오차단 가능성이 있다.
3. `xdr/alerts.log`는 기존 수업 로그이므로 전체를 삭제하거나 덮어쓰지 않는다. 반복 실행 시 로그가 추가로 쌓이는 것은 의도된 동작이다.
4. 실제 비밀번호·토큰·개인키·고객 정보를 저장소·콘솔·로그에 넣지 않는다.
5. 테스트·배포·커밋 및 공식 채점은 각기 다른 절차이다. 공식 채점 완료라고 표기하지 않는다.

## 근거 링크

- NIST NVD: https://nvd.nist.gov/vuln/detail/CVE-2021-44228
- MITRE ATT&CK T1190: https://attack.mitre.org/techniques/T1190/
