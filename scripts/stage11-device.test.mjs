import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash, generateKeyPairSync, sign } from 'node:crypto';
import { canonicalDeviceRequest, checkSignature, requireApprovedDevice, enrollmentPayload } from '../src/device-signature.mjs';

const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicKey = keys.publicKey.export({ format: 'jwk' });
const id = randomUUID(), userId = randomUUID();
const signPayload = payload => sign('sha256', Buffer.from(payload),
  { key: keys.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const sha = value => createHash('sha256').update(value).digest('hex');
const nonce = randomBytes(32).toString('base64url');
const now = String(Date.now());
const base = { deviceId: id, nonce, timestamp: now, method: 'PUT',
  path: '/api/notes/11111111-1111-4111-8111-111111111111',
  body: JSON.stringify({ title: 'T', body: 'ORIGINAL' }) };
const signature = signPayload(canonicalDeviceRequest(base));
const headers = { 'x-bb-device-id': id, 'x-bb-nonce': nonce,
  'x-bb-timestamp': now, 'x-bb-signature': signature };
const req = { method: base.method, url: base.path,
  body: JSON.parse(base.body), headers };

function fakeDb(status = 'approved') {
  let consumed = false;
  return { rpc: async (name, params) => {
    if (name === 'stage11_device_read') return {
      data: status === 'approved' ? { status, publicKey } : null, error: null
    };
    if (name === 'stage11_consume_nonce') {
      const allow = !consumed && params.p_owner === userId &&
        params.p_id === id && params.p_nonce_hash === sha(nonce);
      if (allow) consumed = true;
      return { data: allow, error: null };
    }
    throw Error('Unexpected RPC '+name);
  }};
}

test('enrollment proves private-key possession', () => {
  assert.equal(checkSignature(publicKey, enrollmentPayload(id), signPayload(enrollmentPayload(id))), true);
  assert.equal(checkSignature(publicKey, enrollmentPayload(randomUUID()), signPayload(enrollmentPayload(id))), false);
});
test('signed method/path/body digest binds the protected request', () => {
  assert.equal(checkSignature(publicKey, canonicalDeviceRequest(base), signature), true);
  for (const change of [
    { method: 'POST' }, { path: base.path + '?other=1' },
    { path: '/api/notes/22222222-2222-4222-8222-222222222222' },
    { body: JSON.stringify({ title: 'T', body: 'TAMPERED' }) }
  ]) {
    assert.equal(checkSignature(publicKey, canonicalDeviceRequest({ ...base, ...change }), signature), false);
  }
});
test('approved signature is accepted once, repeated nonce is denied', async () => {
  const db = fakeDb();
  assert.equal(await requireApprovedDevice(req, { userId }, db), true);
  assert.equal(await requireApprovedDevice(req, { userId }, db), false);
});
test('missing signature, unapproved device, modified path/body are denied', async () => {
  assert.equal(await requireApprovedDevice({ ...req, headers: {} }, { userId }, fakeDb()), false);
  assert.equal(await requireApprovedDevice(req, { userId }, fakeDb('pending')), false);
  assert.equal(await requireApprovedDevice({ ...req, url: base.path+'?x=1' }, { userId }, fakeDb()), false);
  assert.equal(await requireApprovedDevice({ ...req, body: { title: 'T', body: 'TAMPERED' } }, { userId }, fakeDb()), false);
  assert.equal(await requireApprovedDevice({ ...req, headers: { ...headers, 'x-bb-timestamp': String(Date.now()-180000) } }, { userId }, fakeDb()), false);
});
