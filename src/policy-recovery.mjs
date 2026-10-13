import { createHash } from 'node:crypto';

// This is an isolated TEST POLICY, not live Supabase grants/RLS.
export const SAFE_POLICY = Object.freeze({
  version: 'owner-notes-v1',
  select: 'auth.uid() = owner_id',
  insert: 'auth.uid() = owner_id',
  update: 'auth.uid() = owner_id',
  delete: 'auth.uid() = owner_id',
  rlsEnabled: true
});

const canonical = value => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b))));
export const policyDigest = value => createHash('sha256').update(canonical(value)).digest('hex');

// Do not accept an unverified or incomplete backup.
export function comparePolicy(backup, current, expectedDigest) {
  if (!backup || typeof backup !== 'object' || Array.isArray(backup) ||
      !current || typeof current !== 'object' || Array.isArray(current) ||
      typeof expectedDigest !== 'string' || !/^[a-f0-9]{64}$/i.test(expectedDigest) ||
      policyDigest(backup) !== expectedDigest.toLowerCase() ||
      canonical(backup) !== canonical(SAFE_POLICY)) {
    throw new Error('unverified_policy_backup');
  }
  const changes = Object.keys(SAFE_POLICY).filter(key => current[key] !== backup[key]);
  return { backupVersion: backup.version, changes, verified: true };
}

export function restoreTestPolicy(backup, current, expectedDigest, confirmed = false) {
  const preview = comparePolicy(backup, current, expectedDigest);
  if (!confirmed) return { applied: false, ...preview };
  // Return a NEW test-policy object: no DB or audit log is modified.
  return { applied: true, ...preview, policy: { ...current, ...backup } };
}
