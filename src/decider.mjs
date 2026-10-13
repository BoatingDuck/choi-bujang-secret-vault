// ALEPH SDP 엔진이 신원·기기·경로를 확인하여 전달한 요청만 판정합니다.
// 6단계: 등록 기기에서의 요청만 기기 등록 규칙을 통과합니다.
// 인증서, 토큰, 개인키 및 자료 본문은 수집하거나 저장하지 않습니다.
export const RULE_IDS = Object.freeze(['device_registered']);

export async function decide(request) {
  const registered = request?.deviceRegistered === true;

  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: registered ? 'allow' : 'deny',
    reasonCode: registered ? 'approved' : 'device_not_registered',
    ruleIds: ['device_registered'],
  };
}
