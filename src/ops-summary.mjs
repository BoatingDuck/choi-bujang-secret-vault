// Stage 12: safe operational summaries. NO real note bodies or credentials.
export const OPS_SCHEMA = 'byteback.ops.v1';

export function summarizeVirtualDetection(detect) {
  const firstAt = Date.UTC(2026, 9, 14, 0, 0, 0);
  const make = count => Array.from({ length: count }, (_, i) => ({
    at: new Date(firstAt + i * 2_000).toISOString(),
    method: 'GET',
    identity: { sub: 'stage12_virtual_subject' }
  }));
  const below = detect(make(120));
  const above = detect(make(121));
  const passed = below?.action === 'observe' &&
    above?.action === 'propose_revocation' &&
    above?.reasonCode === 'burst_read' &&
    above?.subject === 'stage12_virtual_subject';
  return {
    kind: 'VIRTUAL_FIXTURE',
    status: passed ? 'PASS' : 'FAIL',
    normalRequestCount: 120,
    normalAction: below?.action ?? 'UNKNOWN',
    burstRequestCount: 121,
    burstAction: above?.action ?? 'UNKNOWN',
    realEngineEvents: 'NOT_RUN'
  };
}

export function safeOpsView({ requestId, checkedAt, ruleIds, detection, recovery, notes, deploymentCommit }) {
  if (!Array.isArray(ruleIds) || ruleIds.some(x => typeof x !== 'string')) {
    throw new Error('invalid_rules');
  }
  return {
    schema: OPS_SCHEMA,
    requestId,
    checkedAt,
    deploymentCommit: /^[a-f0-9]{40}$/i.test(deploymentCommit ?? '') ? deploymentCommit : null,
    access: { status: 'VERIFIED_ON_THIS_REQUEST', method: 'GET', path: '/api/ops/status' },
    decision: {
      source: 'src/decider.mjs',
      ruleCount: ruleIds.length,
      ruleIds: [...ruleIds],
      liveEngineDecision: 'NOT_RUN'
    },
    detection: { source: 'src/detect.mjs', ...detection },
    revocation: {
      proposedByFixture: detection.burstAction === 'propose_revocation',
      actualEngineRevocation: 'NOT_RUN',
      source: 'ALEPH SDP engine (provided; execution not verified)'
    },
    recovery,
    notes,
    totalAssaultTests: { total: 41, verified: null, status: 'NOT_RUN' }
  };
}
