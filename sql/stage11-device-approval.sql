-- Stage 11: device registration and single-use signing challenge.
-- Creates isolated tables/functions only. Does not alter notes, RLS or historical audit rows.
BEGIN;
CREATE SCHEMA IF NOT EXISTS recovery_private;
CREATE TABLE IF NOT EXISTS recovery_private.stage11_devices (
  device_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  public_key jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);
CREATE INDEX IF NOT EXISTS stage11_devices_owner_idx ON recovery_private.stage11_devices(owner_id);
CREATE TABLE IF NOT EXISTS recovery_private.stage11_nonces (
  nonce_hash text PRIMARY KEY CHECK (nonce_hash ~ '^[0-9a-f]{64}$'),
  device_id uuid NOT NULL REFERENCES recovery_private.stage11_devices(device_id),
  owner_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS stage11_nonces_expiry_idx ON recovery_private.stage11_nonces(expires_at);
REVOKE ALL ON TABLE recovery_private.stage11_devices FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE recovery_private.stage11_nonces FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.stage11_register_device(
  p_owner uuid, p_id uuid, p_public_key jsonb
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE outcome text;
BEGIN
  IF p_owner IS NULL OR p_id IS NULL OR jsonb_typeof(p_public_key) <> 'object' OR
     p_public_key->>'kty' IS DISTINCT FROM 'EC' OR
     p_public_key->>'crv' IS DISTINCT FROM 'P-256' OR
     p_public_key ? 'd' THEN RAISE EXCEPTION 'invalid device registration'; END IF;
  INSERT INTO recovery_private.stage11_devices(device_id,owner_id,public_key)
    VALUES(p_id,p_owner,p_public_key) ON CONFLICT (device_id) DO NOTHING;
  SELECT status INTO outcome FROM recovery_private.stage11_devices
    WHERE device_id=p_id AND owner_id=p_owner AND public_key=p_public_key;
  IF outcome IS NULL THEN RAISE EXCEPTION 'device id collision'; END IF;
  RETURN outcome;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.stage11_device_status(
  p_owner uuid, p_id uuid
) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
 SELECT status FROM recovery_private.stage11_devices
 WHERE owner_id=p_owner AND device_id=p_id;
$fn$;

CREATE OR REPLACE FUNCTION public.stage11_device_read(
  p_owner uuid, p_id uuid
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
 SELECT jsonb_build_object('status',status,'publicKey',public_key)
 FROM recovery_private.stage11_devices
 WHERE owner_id=p_owner AND device_id=p_id AND status='approved';
$fn$;

CREATE OR REPLACE FUNCTION public.stage11_issue_nonce(
  p_owner uuid, p_id uuid, p_nonce_hash text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF p_nonce_hash !~ '^[0-9a-f]{64}$' OR NOT EXISTS (
    SELECT 1 FROM recovery_private.stage11_devices
    WHERE owner_id=p_owner AND device_id=p_id AND status='approved'
  ) THEN RETURN false; END IF;
  INSERT INTO recovery_private.stage11_nonces(nonce_hash,device_id,owner_id,expires_at)
  VALUES(p_nonce_hash,p_id,p_owner,now() + interval '90 seconds')
  ON CONFLICT (nonce_hash) DO NOTHING;
  RETURN FOUND;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.stage11_consume_nonce(
  p_owner uuid, p_id uuid, p_nonce_hash text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  UPDATE recovery_private.stage11_nonces n SET consumed_at=now()
  WHERE n.nonce_hash=p_nonce_hash AND n.device_id=p_id AND n.owner_id=p_owner
    AND n.consumed_at IS NULL AND n.expires_at>now()
    AND EXISTS (SELECT 1 FROM recovery_private.stage11_devices d
      WHERE d.device_id=p_id AND d.owner_id=p_owner AND d.status='approved');
  RETURN FOUND;
END;
$fn$;

REVOKE ALL ON FUNCTION public.stage11_register_device(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.stage11_device_status(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.stage11_device_read(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.stage11_issue_nonce(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.stage11_consume_nonce(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.stage11_register_device(uuid,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.stage11_device_status(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.stage11_device_read(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.stage11_issue_nonce(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.stage11_consume_nonce(uuid,uuid,text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Approval is a separate, deliberate administrator action in SQL Editor.
-- Verify the requester and device fingerprint independently before updating status.
-- SELECT device_id, owner_id, created_at, status
-- FROM recovery_private.stage11_devices WHERE status='pending' ORDER BY created_at DESC;
-- UPDATE recovery_private.stage11_devices SET status='approved', approved_at=now()
-- WHERE device_id='<verified-device-uuid>'::uuid AND owner_id='<verified-user-uuid>'::uuid
--   AND status='pending';
