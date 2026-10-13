import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [backupPath, currentPath, expectedHash] = process.argv.slice(2);

if (!backupPath || !currentPath || !expectedHash) {
  console.error(
    '사용법: node scripts/compare-policy.mjs <backup.json> <current.json> <expected-sha256>'
  );
  process.exitCode = 1;
} else {
  try {
    const backupBytes = readFileSync(backupPath);
    const actualHash = createHash('sha256')
      .update(backupBytes)
      .digest('hex');

    if (
      !/^[a-f0-9]{64}$/i.test(expectedHash) ||
      actualHash !== expectedHash.toLowerCase()
    ) {
      throw new Error('백업 무결성 검증 실패: 비교를 중단합니다.');
    }

    const backup = JSON.parse(backupBytes.toString('utf8'));
    const current = JSON.parse(readFileSync(currentPath, 'utf8'));

    if (
      !backup || typeof backup !== 'object' || Array.isArray(backup) ||
      !current || typeof current !== 'object' || Array.isArray(current)
    ) {
      throw new Error('정책 파일 형식이 올바르지 않습니다.');
    }

    const changes = [];

    for (const key of new Set([
      ...Object.keys(backup),
      ...Object.keys(current)
    ])) {
      if (JSON.stringify(backup[key]) !== JSON.stringify(current[key])) {
        changes.push(key);
      }
    }

    console.log('백업 SHA-256 검증 성공');
    console.log('복원 기준 버전:', backup.version ?? '버전 정보 없음');
    console.log('변경된 최상위 항목:', changes.length
      ? changes.join(', ')
      : '없음');
    console.log('비교만 수행했습니다. 정책은 변경하지 않았습니다.');
  } catch (error) {
    console.error('정책 비교 중단:', error.message);
    process.exitCode = 1;
  }
}
