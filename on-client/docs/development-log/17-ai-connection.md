# 17단계 | AI 연결 상태와 오류 안내

- **작업일:** 2026-10-26
- **수정 파일:** `on-client/student/extension.mjs`
- **수정 함수:** `renderAiConnection`, `renderExplanation`(기본 화면)
- **학생 코드 커밋:** [c4e0e5b5](https://github.com/BoatingDuck/choi-bujang-secret-vault/commit/c4e0e5b5ea64ee9f40b9c16426be853a3aabff50)
- **시작 틀 업데이트 커밋:** [e76d0a9f](https://github.com/BoatingDuck/choi-bujang-secret-vault/commit/e76d0a9f87432d6feb7830feb529415fd9a49063)
- **공식 결과:** 17단계 통과 (제출 후 확인)

## 작업 내용

AI 연결 버튼을 눌렀다고 해서 실제 모델을 사용할 수 있는 것은 아니다. 연결 전인지, 확인 중인지, 모델 목록을 정상적으로 받았는지, 오류가 났는지를 구분해 보여주는 것이 이번 작업의 목표였다. 특히 모델 목록 조회와 실제 사건 설명 요청을 같은 성공으로 표시하지 않도록 했다.

작업 중에는 포털에서 AI 승인을 마쳤는데도 케셰브에서 연결 결과를 확인하지 못하는 문제가 여러 차례 발생했다. 이 문제는 학생 화면 코드와 별도로 확인했다.

## 수정한 코드

### `renderAiConnection`

- `idle`, `loading`, `ok`, `error`에 따라 다른 안내를 표시했다. 새 결과를 그릴 때 이전 오류나 성공 내용이 그대로 남지 않도록 했다.
- `audienceAuthorization`이 `test`이면 시험 연결, `verified`이면 앱 권한을 확인한 연결이라고 표시했다.
- `transportChecked`, `modelCount`, `checkedAt` 값을 확인한 뒤 모델 수와 점검 시각을 보여줬다.
- 모델 목록 조회가 성공해도 '사건 설명은 아직 실행하지 않았습니다'라는 문구를 표시했다.
- 인증 실패, 권한 제한, 사용량 초과, 이용 시간, 시간 초과, 취소 등 오류 코드에 따라 다른 안내를 작성했다.
- 확인되지 않은 오류 메시지나 인증값을 그대로 화면에 출력하지 않고, 코드에 정해둔 안내 문구를 사용했다.
- 자동 재시도는 넣지 않았다. 다시 확인하려면 사용자가 버튼을 누르도록 안내했다.

### `renderExplanation` (18단계에 앞서 작성한 기본 기능)

- 설명 요청 전, 요청 중, 성공, 실패 상태를 구분했다.
- 성공 응답이면 사건 ID와 요약을 확인한 뒤 `data-student-explanation-event` 속성을 추가했다.
- 실패했거나 응답 형식이 맞지 않으면 성공 표시를 붙이지 않고, 기존 보안 기록은 유지된다고 안내했다.
- 화면에 글자를 넣을 때는 `document.createElement`와 `textContent`를 사용했다.

## 테스트와 결과

| 구분 | 확인 내용 | 결과 |
| --- | --- | --- |
| 로컬 모의 테스트 | 가짜 DOM으로 AI 상태별 문구·속성·오류 분기 등 27개 항목 검사 | 27/27 통과. 실제 API 호출이나 취소 중 뒤늦은 응답 처리는 검사하지 않음 |
| 문법 검사 | `node --check student/extension.mjs` | 통과 |
| AI 연결 | 케셰브 연결 완료 화면 | 확인 |
| 모델 목록 점검 | `audienceAuthorization: verified`, `modelCount: 1` | 확인 |
| 보안 기록 조회 | `ENGINE_NOT_CONNECTED` | 기존 서버 연결을 확인하지 못함. SDP 설정이 원인인지는 별도 확인 필요 |
| 공식 제출 | 17단계 판정 | 통과 |

모델 목록 조회는 성공했지만, 보안 기록 화면에서 실제 사건을 선택해 AI 설명을 요청하는 과정은 로컬에서 확인하지 못했다. 따라서 모델 목록 확인을 사건 설명 실행 성공이라고 기록하지 않는다. 공식 17단계 통과는 사용자에게 확인받았지만, 항목별 세부 판정 내용은 따로 확보하지 못했다.

### 다시 확인할 때 사용한 명령

```powershell
Set-Location "$HOME\choi-bujang-secret-vault\on-client"
node --check .\student\extension.mjs
$pkg = Get-Content .\package.json -Raw | ConvertFrom-Json
$pkg.version
$pkg.scripts.'package-app'
```

## 정리

연결 오류가 반복될 때 처음부터 학생 코드를 수정하지 않고, 실행 환경과 네트워크 상태부터 확인했다. 확인한 결과를 담당자에게 전달해 서버 측 문제를 구분할 수 있었고, 수정된 시작 틀로 업데이트한 뒤 AI 모델 목록 조회까지 확인했다.

이번 단계에서 직접 구현한 부분은 **연결 성공과 실패를 화면에서 분명하게 구분하는 기능**이다. 외부 서버 문제 해결과 내 코드 수정은 별도 작업으로 남겼다.
