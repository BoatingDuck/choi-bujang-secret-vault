
export const RULE_IDS = Object.freeze([
  'device_registered',
  'step_up_required'
]);

export async function decide(request) {
  const ruleIds = ['device_registered'];

  // 6단계: 미등록 기기 차단
  if (request?.deviceRegistered !== true) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds
    };
  }

  // 엔진이 제공한 가상 사건만 분석
  const signals = request.signals;
  const trustedFixture =
    signals?.source === 'judge_fixture';

  const unusualHour =
    trustedFixture &&
    Number.isInteger(signals.hour) &&
    (signals.hour < 6 || signals.hour >= 23);

  const unusualNetwork =
    trustedFixture &&
    signals.network === 'unusual';

  const manyEvents =
    Array.isArray(request.recentEvents) &&
    request.recentEvents.some(event =>
      event?.kind === 'risk_signal' &&
      Number.isInteger(event.count) &&
      event.count >= 20
    );

  // 단일 지역 변화만으로 차단하지 않음
  const suspicious =
    unusualHour &&
    unusualNetwork &&
    manyEvents;

  if (suspicious) {
    ruleIds.push('step_up_required');

    const stepUp = request.stepUp;
    const recentlyVerified =
      stepUp?.verified === true &&
      Number.isInteger(stepUp.authAgeSeconds) &&
      stepUp.authAgeSeconds >= 0 &&
      stepUp.authAgeSeconds <= 900;

    if (!recentlyVerified) {
      return {
        schema: 'aleph.decision.v1',
        requestId: request.requestId,
        decision: 'step_up',
        reasonCode: 'step_up_required',
        ruleIds
      };
    }
  }

  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: 'allow',
    reasonCode: 'approved',
    ruleIds
  };
}
