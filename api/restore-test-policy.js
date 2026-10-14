import { createClient } from '@supabase/supabase-js';
import { requireApprovedDevice } from '../src/device-signature.mjs';
import { verifyRequestUser, isAllowedWriteOrigin } from '../src/auth-session.mjs';
import {
  PINNED_SAFE_POLICY_SHA256, policyDigest,
  comparePolicy,
  restoreTestPolicy
} from '../src/policy-recovery.mjs';

const DIGEST = /^[0-9a-f]{64}$/i;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST 요청만 허용합니다.' });
  }
  if (!req.headers.authorization && !req.headers.cookie) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  if (!isAllowedWriteOrigin(req)) {
    return res.status(403).json({ error: '허용되지 않은 요청 출처입니다.' });
  }

  let user;
  try { user = await verifyRequestUser(req); } catch { /* fail closed */ }
  if (!user?.userId) return res.status(401).json({ error: '인증 실패' });

  // Only judge B, or explicitly configured local student B, may modify the
  // isolated TEST policy. Ordinary student A and other judge identities cannot.
  const permitted = (user.kind === 'judge' && user.identity === 'b') ||
    (user.kind === 'student' &&
      typeof process.env.STAGE10_TEST_B_USER_ID === 'string' &&
      user.userId === process.env.STAGE10_TEST_B_USER_ID);
  if (!permitted) return res.status(403).json({ error: 'B 시험 계정 전용' });

  if (!await requireApprovedDevice(req, user).catch(() => false)) {
    return res.status(403).json({ error: '승인된 기기 서명이 필요합니다.' });
  }

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      (body.confirm !== true && body.confirm !== false)) {
    return res.status(400).json({ error: 'confirm 값이 필요합니다.' });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return res.status(503).json({ error: '시험 정책 DB 설정 없음' });
  }
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // Fresh verified private backup and current test state, never a policy
    // supplied by the caller. A corrupted/missing backup blocks all writes.
    const { data: state, error } = await db.rpc('stage10_policy_preview');
    if (error || !state || !Number.isSafeInteger(state.revision)) {
      throw new Error('policy_snapshot_unavailable');
    }
    const preview = comparePolicy(state.backup, state.current, state.backup_sha256);
    const view = {
      applied: false,
      backupVersion: preview.backupVersion,
      backupSha256: preview.backupSha256,
      revision: state.revision,
      changedFields: preview.changes,
      scope: 'isolated_test_policy_only'
    };
    if (body.confirm === false) return res.status(200).json({ preview: view });

    // Explicit preview/revision acknowledgement is required before apply.
    if (!Number.isSafeInteger(body.expectedRevision) ||
        !DIGEST.test(body.expectedSha256 ?? '') ||
        body.expectedRevision !== state.revision ||
        body.expectedSha256.toLowerCase() !== PINNED_SAFE_POLICY_SHA256) {
      return res.status(409).json({
        error: '먼저 미리보기를 확인하고 버전·해시를 지정해야 합니다.',
        preview: view
      });
    }

    // The RPC re-reads the snapshot under a DB row lock, checks the pinned
    // digest, and updates only the isolated policy keys transactionally.
    const { data: applied, error: applyError } = await db.rpc('stage10_policy_apply', {
      p_expected_revision: body.expectedRevision,
      p_expected_sha256: body.expectedSha256
    });
    if (applyError || !applied || !Number.isSafeInteger(applied.revision)) {
      throw new Error('policy_apply_failed');
    }
    const finalPolicy = restoreTestPolicy(
      state.backup, state.current, state.backup_sha256, true
    ).policy;
    if (policyDigest(applied.current) !== policyDigest(finalPolicy)) {
      // Do not report successful repair if the DB result differs.
      throw new Error('policy_post_verify_failed');
    }
    return res.status(200).json({
      restored: true,
      preview: view,
      resultRevision: applied.revision,
      scope: 'isolated_test_policy_only',
      auditHistory: 'NOT_CHECKED',
      productionRlsChanged: false
    });
  } catch {
    return res.status(409).json({ error: '검증된 시험 정책 사본을 적용하지 못했습니다.' });
  }
}
