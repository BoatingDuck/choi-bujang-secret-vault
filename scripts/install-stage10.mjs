// Run once from repository root: node scripts/install-stage10.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const cwd = process.cwd();
const gitStatus = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
// The new 10-stage patch files are untracked; other unrelated modifications should stop installation.
const known = new Set(['api/restore-note.js','src/policy-recovery.mjs','src/note-recovery.mjs','scripts/recovery-test.mjs','scripts/install-stage10.mjs','docs/STAGE10.md','scripts/compare-policy.mjs']);
const unrelated = gitStatus.split(/\r?\n/).filter(Boolean).filter(line => !known.has(line.slice(3).replace(/\\/g,'/')));
if (unrelated.length) throw new Error('기존 변경 사항을 먼저 확인하세요: '+unrelated.join('; '));
const source = readFileSync('src/attack-check.mjs','utf8').replace(/\r\n/g, '\n');
if (!source.includes('if (config.step === 9) {')) throw new Error('기존 9단계 공격 점검 분기를 찾을 수 없습니다.');
let updated = source.replace('if (config.step === 9) {', 'if (config.step === 9 || config.step === 10) {')
  .replace('const results = await runStage4Checks(config, 9);', 'const results = await runStage4Checks(config, config.step);');
const marker = `    return results;\n  }\n\n  if (`;
if (!updated.includes(marker)) throw new Error('기존 공격 점검 반환 위치를 찾을 수 없습니다.');
updated = updated.replace(marker, `    if (config.step === 10) {
      const { SAFE_POLICY, policyDigest, comparePolicy, restoreTestPolicy } = await import('./policy-recovery.mjs');
      const backup = { ...SAFE_POLICY };
      const current = { ...backup, select: 'true', anotherService: 'unchanged' };
      const digest = policyDigest(backup);
      const comparison = comparePolicy(backup, current, digest);
      const preview = restoreTestPolicy(backup, current, digest, false);
      const restored = restoreTestPolicy(backup, current, digest, true);
      if (!comparison.changes.includes('select') || preview.applied ||
          restored.policy.select !== backup.select || restored.policy.anotherService !== 'unchanged') {
        throw new Error('10단계 시험 정책 복원 로컬 점검 실패');
      }
      results.push({
        attackId: 'test_policy_recovery',
        expected: '가상 정책 사본 검증 후 다른 서비스 설정 보존',
        observed: '로컬 시험 통과 (운영 정책 미변경)'
      });
    }
    return results;
  }

  if (`);
const config = JSON.parse(readFileSync('aleph.config.json','utf8'));
if (config.step !== 9) throw new Error('현재 단계가 9가 아닙니다.');
const pkg = JSON.parse(readFileSync('package.json','utf8'));
if (!pkg.scripts) throw new Error('package.json scripts 확인 필요');
const notes = JSON.parse(readFileSync('bundle-notes.json','utf8'));
if (typeof notes.explanation !== 'string') throw new Error('bundle-notes.json 확인 필요');
const readme = readFileSync('README.md','utf8');
// All validations finished. Now write only stage-10 configuration files.
writeFileSync('src/attack-check.mjs',updated,'utf8');
config.step = 10;
config.restoreRoute = '/api/restore-note';
writeFileSync('aleph.config.json',JSON.stringify(config,null,2)+'\n','utf8');
pkg.scripts['recovery:test']='node scripts/recovery-test.mjs';
writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n','utf8');
notes.explanation = '10단계 시험 정책 사본 비교와 확인 후 시험 정책 객체 복원 기능을 추가하였다.\n비공개 메모 사본의 ID·소유자·내용 해시 검증과 단일 메모 POST 복구 경로를 작성하였다.\n실제 B 메모 사본 확보, 운영 복원 및 A/B 계정 공격 재검증은 아직 미실행이다.';
writeFileSync('bundle-notes.json',JSON.stringify(notes,null,2)+'\n','utf8');
if (!readme.includes('## 9단계 저장점')) {
  writeFileSync('README.md',readme+'\n\n## 9단계 저장점\n- `src/detect.mjs`에서 사용자별 10분 내 GET 120건 초과를 탐지해 `propose_revocation`을 제안한다. 로컬 `npm.cmd run detect:test` 6/6 통과를 확인하였으며 실제 회수는 별도 심판 판정이다.\n\n## 10단계 — 백업에서 자료실을 되살립니다\n- 시험 정책 및 단일 메모 복구 구현과 미실행 항목은 `docs/STAGE10.md` 참조.\n- 로컬 재검사: `npm.cmd run recovery:test`, `npm.cmd run decider:test`, `npm.cmd run detect:test`.\n- 실제 복원 전 비공개 B 메모 백업 확보 및 검증이 필수다.\n','utf8');
}
console.log('Stage 10 files configured. No DB writes. Run node --check src/attack-check.mjs and npm.cmd run recovery:test');
