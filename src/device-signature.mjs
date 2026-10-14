import { createHash, createPublicKey, timingSafeEqual, verify } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const DEVICE_UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const SHA256 = text => createHash('sha256').update(text).digest('hex');

export function validPublicJwk(key) {
  return !!key && typeof key === 'object' && !Array.isArray(key) &&
    key.kty === 'EC' && key.crv === 'P-256' &&
    typeof key.x === 'string' && /^[A-Za-z0-9_-]{43}$/.test(key.x) &&
    typeof key.y === 'string' && /^[A-Za-z0-9_-]{43}$/.test(key.y) &&
    !('d' in key) && Object.keys(key).every(k => ['kty', 'crv', 'x', 'y', 'ext', 'key_ops'].includes(k));
}

export function deviceDb() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error('device_database_not_configured');
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function canonicalDeviceRequest({ deviceId, nonce, timestamp, method, path, body }) {
  if (!DEVICE_UUID.test(deviceId) || !BASE64URL.test(nonce) ||
      typeof timestamp !== 'string' || !/^\d{13}$/.test(timestamp) ||
      !['GET', 'POST', 'PUT', 'DELETE'].includes(method) ||
      typeof path !== 'string' || !path.startsWith('/') ||
      typeof body !== 'string') throw new Error('invalid_signature_input');
  return ['BYTEBACK-DEVICE-V1', deviceId, nonce, timestamp, method, path, SHA256(body)].join('\n');
}

export function checkSignature(key, payload, signature) {
  if (!validPublicJwk(key) || typeof signature !== 'string' ||
      !BASE64URL.test(signature) || signature.length > 128) return false;
  try {
    const raw = Buffer.from(signature, 'base64url');
    if (raw.length !== 64) return false;
    const publicKey = createPublicKey({ key, format: 'jwk' });
    return verify('sha256', Buffer.from(payload),
      { key: publicKey, dsaEncoding: 'ieee-p1363' }, raw);
  } catch { return false; }
}

export function enrollmentPayload(deviceId) {
  if (!DEVICE_UUID.test(deviceId)) throw new Error('invalid_device_id');
  return `BYTEBACK-DEVICE-ENROLL-V1\n${deviceId}`;
}

export async function requireApprovedDevice(req, user, db = deviceDb()) {
  if (!user?.userId || !DEVICE_UUID.test(user.userId)) return false;
  const h = req.headers ?? {};
  const id = h['x-bb-device-id'];
  const nonce = h['x-bb-nonce'];
  const timestamp = h['x-bb-timestamp'];
  const signature = h['x-bb-signature'];
  if (!DEVICE_UUID.test(id ?? '') || typeof nonce !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(nonce) ||
      typeof timestamp !== 'string' || !/^\d{13}$/.test(timestamp) ||
      Math.abs(Date.now() - Number(timestamp)) > 60_000) return false;
  const { data, error } = await db.rpc('stage11_device_read', {
    p_owner: user.userId, p_id: id
  });
  if (error || !data || data.status !== 'approved' || !validPublicJwk(data.publicKey)) return false;
  let path;
  try {
    const url = new URL(req.url, 'https://local.invalid');
    path = url.pathname + url.search;
  } catch { return false; }
  // GET and DELETE have no semantic request body in these handlers.
  const body = req.method === 'GET' || req.method === 'DELETE'
    ? '' : req.body === undefined || req.body === null
      ? '' : typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  let payload;
  try {
    payload = canonicalDeviceRequest({ deviceId: id, nonce, timestamp,
      method: req.method, path, body });
  } catch { return false; }
  if (!checkSignature(data.publicKey, payload, signature)) return false;
  const hash = SHA256(nonce);
  const consumed = await db.rpc('stage11_consume_nonce', {
    p_owner: user.userId, p_id: id, p_nonce_hash: hash
  });
  return !consumed.error && consumed.data === true;
}
