import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deploymentIdentity } from './deployment-identity.mjs';

const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'public');

const config = JSON.parse(
  await readFile(resolve(root, 'aleph.config.json'), 'utf8')
);

if (!Number.isInteger(config.step) ||
    config.step < 2 ||
    config.step > 12) {
  throw new Error('2단계 이후의 설정을 확인해 주세요.');
}

await mkdir(publicDir, { recursive: true });

await rm(resolve(publicDir, 'data.json'), {
  force: true
});

console.log('공개 data.json 제거를 확인했습니다.');

if (!process.argv.includes('--local')) {
  const identity = deploymentIdentity(process.env, config);

  await writeFile(
    resolve(publicDir, 'aleph.json'),
    `${JSON.stringify(identity, null, 2)}\n`,
    'utf8'
  );

  console.log('배포 식별 파일을 생성했습니다.');
}
