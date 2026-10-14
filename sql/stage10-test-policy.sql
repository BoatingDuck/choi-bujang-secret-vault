-- Stage 10: ISOLATED TEST POLICY ONLY. Run once in Supabase SQL Editor.
-- This creates no production RLS policy, GRANT, or application-note write.
-- Timestamp is the actual installation time; this is NOT evidence that
-- the snapshot existed before any incident already in the past.
BEGIN;

CREATE SCHEMA IF NOT EXISTS recovery_private;
-- Preserve existing schema privileges, including service_role access.

CREATE TABLE IF NOT EXISTS recovery_private.stage10_test_policy_backup (
  id text PRIMARY KEY CHECK (id = 'owner-notes-v1'),
  policy jsonb NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS recovery_private.stage10_test_policy_state (
  id text PRIMARY KEY CHECK (id = 'owner-notes-v1'),
  policy jsonb NOT NULL,
  revision bigint NOT NULL CHECK (revision >= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON recovery_private.stage10_test_policy_backup FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON recovery_private.stage10_test_policy_state FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION recovery_private.stage10_backup_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  RAISE EXCEPTION 'test policy backup is immutable';
END;
$fn$;
REVOKE ALL ON FUNCTION recovery_private.stage10_backup_immutable() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS trg_stage10_policy_backup_immutable ON recovery_private.stage10_test_policy_backup;
CREATE TRIGGER trg_stage10_policy_backup_immutable
BEFORE UPDATE OR DELETE ON recovery_private.stage10_test_policy_backup
FOR EACH ROW EXECUTE FUNCTION recovery_private.stage10_backup_immutable();

-- Baseline verified against the pinned SHA-256 in src/policy-recovery.mjs.
-- ON CONFLICT DO NOTHING: never overwrite a stored backup.
INSERT INTO recovery_private.stage10_test_policy_backup(id, policy, sha256)
VALUES (
  'owner-notes-v1',
  '{"version":"owner-notes-v1","select":"auth.uid() = owner_id","insert":"auth.uid() = owner_id","update":"auth.uid() = owner_id","delete":"auth.uid() = owner_id","rlsEnabled":true}'::jsonb,
  '2e6afa6bfe435f85ae5872e843ee975037db37d42674ee3b9f2815c5ee12624b'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO recovery_private.stage10_test_policy_state(id, policy, revision)
SELECT id, policy, 1 FROM recovery_private.stage10_test_policy_backup
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.stage10_policy_preview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  b recovery_private.stage10_test_policy_backup%ROWTYPE;
  s recovery_private.stage10_test_policy_state%ROWTYPE;
  expected jsonb := '{"version":"owner-notes-v1","select":"auth.uid() = owner_id","insert":"auth.uid() = owner_id","update":"auth.uid() = owner_id","delete":"auth.uid() = owner_id","rlsEnabled":true}'::jsonb;
BEGIN
  SELECT * INTO b FROM recovery_private.stage10_test_policy_backup WHERE id='owner-notes-v1';
  SELECT * INTO s FROM recovery_private.stage10_test_policy_state WHERE id='owner-notes-v1';
  IF b.id IS NULL OR s.id IS NULL OR b.policy IS DISTINCT FROM expected OR
    b.sha256 <> '2e6afa6bfe435f85ae5872e843ee975037db37d42674ee3b9f2815c5ee12624b' THEN
    RAISE EXCEPTION 'verified test policy backup missing or invalid';
  END IF;
  RETURN jsonb_build_object('backup',b.policy,'backup_sha256',b.sha256,
                            'current',s.policy,'revision',s.revision,
                            'version',b.id);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.stage10_policy_apply(
  p_expected_revision bigint, p_expected_sha256 text
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  b recovery_private.stage10_test_policy_backup%ROWTYPE;
  s recovery_private.stage10_test_policy_state%ROWTYPE;
  expected jsonb := '{"version":"owner-notes-v1","select":"auth.uid() = owner_id","insert":"auth.uid() = owner_id","update":"auth.uid() = owner_id","delete":"auth.uid() = owner_id","rlsEnabled":true}'::jsonb;
BEGIN
  SELECT * INTO b FROM recovery_private.stage10_test_policy_backup WHERE id='owner-notes-v1' FOR SHARE;
  SELECT * INTO s FROM recovery_private.stage10_test_policy_state WHERE id='owner-notes-v1' FOR UPDATE;
  IF b.id IS NULL OR s.id IS NULL OR b.policy IS DISTINCT FROM expected OR
     b.sha256 <> '2e6afa6bfe435f85ae5872e843ee975037db37d42674ee3b9f2815c5ee12624b' OR
     p_expected_sha256 IS DISTINCT FROM b.sha256 OR
     p_expected_revision IS DISTINCT FROM s.revision THEN
    RAISE EXCEPTION 'missing/invalid/stale test policy backup';
  END IF;
  UPDATE recovery_private.stage10_test_policy_state
  SET policy = s.policy || b.policy,
      revision = s.revision + 1,
      updated_at = now()
  WHERE id = 'owner-notes-v1'
  RETURNING * INTO s;
  RETURN jsonb_build_object('current',s.policy,'revision',s.revision);
END;
$fn$;

REVOKE ALL ON FUNCTION public.stage10_policy_preview() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stage10_policy_apply(bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stage10_policy_preview() TO service_role;
GRANT EXECUTE ON FUNCTION public.stage10_policy_apply(bigint,text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;

SELECT
  has_function_privilege('anon','public.stage10_policy_preview()','EXECUTE') AS anon_can_preview,
  has_function_privilege('authenticated','public.stage10_policy_preview()','EXECUTE') AS authenticated_can_preview,
  has_function_privilege('service_role','public.stage10_policy_preview()','EXECUTE') AS service_role_can_preview;
