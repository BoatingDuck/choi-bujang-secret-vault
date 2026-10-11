
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: '허용되지 않은 요청입니다.'
    });
  }

  const origin = req.headers.origin;
  const host = req.headers.host;

  let allowed = false;

  try {
    allowed =
      typeof origin === 'string' &&
      typeof host === 'string' &&
      new URL(origin).origin === `https://${host}`;
  } catch {
    allowed = false;
  }

  if (!allowed) {
    return res.status(403).json({
      error: '허용되지 않은 요청 출처입니다.'
    });
  }

  res.setHeader(
    'Set-Cookie',
    'bb_access=; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=0'
  );

  return res.status(200).json({
    ok: true
  });
}
