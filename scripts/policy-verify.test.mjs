import assert from 'node:assert/strict';
import {
  SAFE_POLICY, PINNED_SAFE_POLICY_SHA256, policyDigest,
  comparePolicy, restoreTestPolicy
} from '../src/policy-recovery.mjs';

const backup = structuredClone(SAFE_POLICY);
const now = { ...backup, select: 'true', otherService: 'unchanged' };
assert.equal(policyDigest(backup), PINNED_SAFE_POLICY_SHA256);
const preview = comparePolicy(backup, now, PINNED_SAFE_POLICY_SHA256);
assert.deepEqual(preview.changes, ['select']);
assert.equal(preview.backupVersion, 'owner-notes-v1');
const applied = restoreTestPolicy(backup, now, PINNED_SAFE_POLICY_SHA256, true);
assert.equal(applied.policy.select, backup.select);
assert.equal(applied.policy.otherService, 'unchanged');
assert.equal(now.select, 'true');
assert.throws(() => comparePolicy({ ...backup, select: 'true' }, now, PINNED_SAFE_POLICY_SHA256));
assert.throws(() => comparePolicy(backup, now, '0'.repeat(64)));
assert.throws(() => restoreTestPolicy(null, now, PINNED_SAFE_POLICY_SHA256, true));
console.log('PASS: pinned test policy version/hash, preview, fail-closed, scope preservation');
console.log('NOT RUN: historical pre-incident policy provenance, judge test');
