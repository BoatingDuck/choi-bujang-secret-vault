import { randomUUID } from 'node:crypto';
import { verifyRequestUser } from '../../src/auth-session.mjs';
import { deviceDb, requireApprovedDevice } from '../../src/device-signature.mjs';
import { RULE_IDS } from '../../src/decider.mjs';
import { detect } from '../../src/detect.mjs';
import { comparePolicy } from '../../src/policy-recovery.mjs';
import { OPS_SCHEMA, safeOpsView, summarizeVirtualDetection } from '../../src/ops-summary.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET 요청만 허용합니다.' });
  }
  if (!req.headers?.authorization && !req.headers?.cookie) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  const user = await verifyRequestUser(req).catch(() => null);
  if (user?.kind !== 'student' || !user.userId) {
    return res.status(401).json({ error: '로그인 확인 실패' });
  }
  if (!await requireApprovedDevice(req, user).catch(() => false)) {
    return res.status(403).json({ error: '승인 기기의 서명이 필요합니다.' });
  }

  const requestId = randomUUID();
  const checkedAt = new Date().toISOString();
  let detection;
  try {
    detection = summarizeVirtualDetection(detect);
  } catch {
    detection = {
      kind: 'VIRTUAL_FIXTURE', status: 'FAIL', normalRequestCount: null,
      normalAction: 'UNKNOWN', burstRequestCount: null, burstAction: 'UNKNOWN',
      realEngineEvents: 'NOT_RUN'
    };
  }

  const recovery = {
    source: 'public.stage10_policy_preview', scope: 'isolated_test_policy_only',
    status: 'UNAVAILABLE', backupVersion: null, revision: null, changedFields: null
  };
  const notes = { source: 'public.notes (owner count only)', status: 'UNAVAILABLE', ownedCount: null };

  // Read only, independently. Failure of one summary never pretends to be success.
  try {
    const db = deviceDb();
    const { data, error } = await db.rpc('stage10_policy_preview');
    if (error || !data || !Number.isSafeInteger(data.revision)) throw new Error('unavailable');
    const verified = comparePolicy(data.backup, data.current, data.backup_sha256);
    recovery.status = 'VERIFIED';
    recovery.backupVersion = verified.backupVersion;
    recovery.revision = data.revision;
    recovery.changedFields = verified.changes;
  } catch { /* unavailable must stay unavailable */ }

  try {
    const db = deviceDb();
    const { count, error } = await db.from('notes')
      .select('note_uuid', { count: 'exact', head: true })
      .eq('owner_id', user.userId);
    if (error || !Number.isSafeInteger(count)) throw new Error('unavailable');
    notes.status = 'VERIFIED';
    notes.ownedCount = count;
  } catch { /* no data is returned on error */ }

  const result = safeOpsView({
    requestId, checkedAt, ruleIds: RULE_IDS, detection, recovery, notes,
    deploymentCommit: process.env.VERCEL_GIT_COMMIT_SHA
  });
  if (result.schema !== OPS_SCHEMA) return res.status(500).json({ error: '응답 형식 오류' });
  return res.status(200).json(result);
}
