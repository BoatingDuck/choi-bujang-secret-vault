import { createHash, timingSafeEqual } from 'node:crypto';

// Isolated, TEST-ONLY owner policy. Never call production GRANT/RLS DDL.
export const SAFE_POLICY = Object.freeze({
  version: 'owner-notes-v1',
  select: 'auth.uid() = owner_id',
  insert: 'auth.uid() = owner_id',
  update: 'auth.uid() = owner_id',
  delete: 'auth.uid() = owner_id',
  rlsEnabled: true
});

// Independently pinned digest for the approved template above. This identifies
// the safe template but does NOT prove it existed before a past incident.
export const PINNED_SAFE_POLICY_SHA256 =
  '2e6afa6bfe435f85ae5872e843ee975037db37d42674ee3b9f2815c5ee12624b';

const POLICY_KEYS = Object.freeze(Object.keys(SAFE_POLICY));
const canonical = value => JSON.stringify(
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
);
export const policyDigest = value =>
  createHash('sha256').update(canonical(value)).digest('hex');

const equalDigest = (a, b) =>
  typeof a === 'string' && typeof b === 'string' &&
  /^[0-9a-f]{64}$/i.test(a) && /^[0-9a-f]{64}$/i.test(b) &&
  timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

export function comparePolicy(backup, current, expectedDigest) {
  if (!backup || typeof backup !== 'object' || Array.isArray(backup) ||
      !current || typeof current !== 'object' || Array.isArray(current) ||
      !equalDigest(expectedDigest, PINNED_SAFE_POLICY_SHA256) ||
      !equalDigest(policyDigest(backup), expectedDigest) ||
      canonical(backup) !== canonical(SAFE_POLICY)) {
    throw new Error('unverified_policy_backup');
  }
  const changes = POLICY_KEYS.filter(key => current[key] !== backup[key]);
  return {
    backupVersion: backup.version,
    backupSha256: PINNED_SAFE_POLICY_SHA256,
    changes,
    verified: true
  };
}

export function restoreTestPolicy(backup, current, expectedDigest, confirmed = false) {
  const preview = comparePolicy(backup, current, expectedDigest);
  if (!confirmed) return { applied: false, ...preview };
  return { applied: true, ...preview, policy: { ...current, ...backup } };
}
