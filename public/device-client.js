// Keys remain in this module's memory only. They are NEVER persisted in storage.
const enc = new TextEncoder();
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const hash = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)))]
  .map(x => x.toString(16).padStart(2, '0')).join('');

export function createDeviceClient() {
  let privateKey = null;
  let deviceId = null;
  let state = 'not_registered';

  const json = async r => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  };

  async function enroll() {
    const keys = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']
    );
    const nextId = crypto.randomUUID();
    const key = await crypto.subtle.exportKey('jwk', keys.publicKey);
    const proof = b64url(await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey,
      enc.encode(`BYTEBACK-DEVICE-ENROLL-V1\n${nextId}`)
    ));
    const response = await json(await fetch('/api/device/register', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: nextId, publicKey: key, proof })
    }));
    privateKey = keys.privateKey;
    deviceId = nextId;
    state = response.status;
    return response;
  }

  async function checkApproval() {
    if (!deviceId || !privateKey) return { status: 'not_registered' };
    const outcome = await json(await fetch(
      `/api/device/status?deviceId=${encodeURIComponent(deviceId)}`,
      { credentials: 'same-origin', cache: 'no-store' }
    ));
    state = outcome.status;
    return outcome;
  }

  async function signedHeaders(path, options = {}) {
    if (state !== 'approved' || !privateKey || !deviceId) {
      throw new Error('기기 승인이 필요합니다.');
    }
    const nonceInfo = await json(await fetch(
      `/api/device/challenge?deviceId=${encodeURIComponent(deviceId)}`,
      { credentials: 'same-origin', cache: 'no-store' }
    ));
    const method = (options.method || 'GET').toUpperCase();
    const url = new URL(path, location.origin);
    if (url.origin !== location.origin) throw new Error('외부 요청 서명 거부');
    const pathname = url.pathname + url.search;
    const body = options.body === undefined || options.body === null ? '' : String(options.body);
    const timestamp = String(Date.now());
    const digest = await hash(body);
    const message = ['BYTEBACK-DEVICE-V1', deviceId, nonceInfo.nonce, timestamp,
      method, pathname, digest].join('\n');
    const signature = b64url(await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' }, privateKey, enc.encode(message)
    ));
    return {
      'X-BB-Device-ID': deviceId,
      'X-BB-Nonce': nonceInfo.nonce,
      'X-BB-Timestamp': timestamp,
      'X-BB-Signature': signature
    };
  }

  function clear() { privateKey = null; deviceId = null; state = 'not_registered'; }
  return { enroll, checkApproval, signedHeaders, clear,
    get status() { return state; }, get id() { return deviceId; } };
}
