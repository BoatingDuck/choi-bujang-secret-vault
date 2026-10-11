import { readFile } from 'node:fs/promises';
import { createLoginVerifier } from './verify-login.mjs';

function readCookie(cookieHeader, name) {
  if (typeof cookieHeader !== 'string') return null;

  const entry = cookieHeader.split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${name}=`));

  if (!entry) return null;

  return entry.slice(name.length + 1);
}

export async function verifyRequestUser(req) {
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseSecretKey) {
    throw new Error('서버 인증 설정이 없습니다.');
  }

  const config = JSON.parse(
    await readFile(
      new URL('../aleph.config.json', import.meta.url),
      'utf8'
    )
  );

  const verifyLogin = createLoginVerifier({
    config,
    supabaseSecretKey
  });

  // 기존 심판 및 API 요청의 Bearer 인증 우선
  if (req.headers.authorization) {
    return verifyLogin(req.headers.authorization);
  }

  // 브라우저 로그인 세션 쿠키 검사
  const token = readCookie(req.headers.cookie, 'bb_access');

  if (!token) return null;

  const verified = await verifyLogin(`Bearer ${token}`);

  // 브라우저 쿠키는 실제 Supabase 사용자에게만 허용
  if (verified?.kind !== 'student') return null;

  return verified;
}

export function isAllowedWriteOrigin(req) {
  // 기존 심판의 Bearer 인증 요청은 변경하지 않는다.
  if (
    typeof req.headers.authorization === 'string' &&
    !req.headers.cookie
    ) {
    return true;
    }

  const origin = req.headers.origin;

  // 브라우저 쿠키 기반 변경 요청은 출처가 반드시 있어야 한다.
  if (typeof origin !== 'string') {
    return false;
  }

  const host = req.headers.host;

  if (typeof host !== 'string') {
    return false;
  }

  try {
    const parsedOrigin = new URL(origin);

    return (
      parsedOrigin.protocol === 'https:' &&
      parsedOrigin.host === host
    );
  } catch {
    return false;
  }
}
