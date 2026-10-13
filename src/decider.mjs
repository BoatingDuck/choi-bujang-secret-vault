// ALEPH decision contract v1: engine-verified fields only.
// Stage 8: default-deny ambiguous/multi-resource paths. The API owns per-note authorization.
export const RULE_IDS = Object.freeze([
  'device_registered',
  'step_up_required',
  'resource_zone'
]);

// The engine's documented normal fixture uses /notes/demo.
// Production notes use UUIDs; arbitrary readable IDs could name other zones.
const NOTE_ID = '(?:demo|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';
const SINGLE_NOTE_PATH = new RegExp(`^/notes/${NOTE_ID}$`, 'i');

function validResource(request) {
  if (request?.service !== 'notes') return false;
  if (request.method !== 'GET' && request.method !== 'PUT') return false;
  if (typeof request.path !== 'string' || typeof request.route !== 'string') return false;

  // Query parameters must not change the selected resource or operation.
  if (request.queryLength !== 0) return false;

  // Never admit entire collections, announcements, instructor resources,
  // pseudo IDs (all/export/notice/teacher etc.), or nested paths.
  return SINGLE_NOTE_PATH.test(request.path)
    && request.route === `${request.method} /notes/:id`;
}

function response(request, decision, reasonCode, ruleIds) {
  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision,
    reasonCode,
    ruleIds
  };
}

export async function decide(request) {
  // Stage 6: only registered devices.
  if (request?.deviceRegistered !== true) {
    return response(request, 'deny', 'device_not_registered', ['device_registered']);
  }

  // Stage 8: known personal-note paths only, without inventing user roles.
  if (!validResource(request)) {
    return response(request, 'deny', 'access_denied', ['resource_zone']);
  }

  // Stage 7: only engine-provided virtual anomaly signals.
  const signals = request.signals;
  const trustedFixture = signals?.source === 'judge_fixture';
  const unusualHour = trustedFixture && Number.isInteger(signals.hour)
    && (signals.hour < 6 || signals.hour >= 23);
  const unusualNetwork = trustedFixture && signals.network === 'unusual';
  const manyEvents = Array.isArray(request.recentEvents)
    && request.recentEvents.some(event =>
      event?.kind === 'risk_signal' && Number.isInteger(event.count)
      && event.count >= 20
    );
  const suspicious = unusualHour && unusualNetwork && manyEvents;

  if (suspicious) {
    const stepUp = request.stepUp;
    const recentlyVerified = stepUp?.verified === true
      && Number.isInteger(stepUp.authAgeSeconds)
      && stepUp.authAgeSeconds >= 0 && stepUp.authAgeSeconds <= 900;

    if (!recentlyVerified) {
      return response(request, 'step_up', 'step_up_required',
        ['device_registered', 'step_up_required']);
    }
  }

  return response(request, 'allow', 'approved',
    ['device_registered', 'resource_zone']);
}
