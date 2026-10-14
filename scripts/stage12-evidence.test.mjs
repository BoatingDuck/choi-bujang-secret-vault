import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { CHECK_CASES, EVIDENCE_SCHEMA, runSafeEvidenceChecks } from '../public/ops-checks.js';

function fixture() {
  let n = 0;
  const used = new Set();
  const requests = [];
  async function signedHeaders() { return { 'X-Fixture-Nonce': `nonce-${++n}` }; }
  async function fetchImpl(url, opt) {
    requests.push({ url, opt });
    let status;
    if (url === '/data.json') status = 404;
    else if (url === '/api/auth/session') status = 200;
    else if (url === '/api/restore-note') status = 401;
    else if (opt.credentials === 'omit') status = 401;
    else if (!opt.headers?.['X-Fixture-Nonce']) status = 403;
    else if (used.has(opt.headers['X-Fixture-Nonce'])) status = 403;
    else {
      used.add(opt.headers['X-Fixture-Nonce']);
      status = url.includes('?') || opt.method === 'POST' ? 403 : 200;
    }
    return { status };
  }
  return { requests, fetchImpl, signedHeaders };
}

const deps = f => ({ ...f, newId: () => 'fixture-request-id', now: () => '2026-10-14T14:00:00.000Z' });

test('matrix covers all 11 stages; 41 official attacks stay NOT_RUN', async () => {
  const f = fixture();
  const report = await runSafeEvidenceChecks(deps(f));
  assert.equal(report.schema, EVIDENCE_SCHEMA);
  assert.deepEqual([...new Set(report.rows.map(r => r.step))], Array.from({length:11}, (_,i)=>i+1));
  assert.deepEqual(report.assault41, { total: 41, status: 'NOT_RUN', verified: null });
  assert.equal(report.requestIdKind, 'CLIENT_GENERATED_ONLY');
  assert.equal(report.counts.mismatch, 0);
  assert.equal(report.counts.unavailable, 0);
  assert.ok(report.counts.match >= 9);
  assert.ok(report.counts.notRun >= 4);
  for (const row of report.rows) {
    if (row.result === 'MATCH') {
      assert.equal(typeof row.observedHttp, 'number');
      assert.ok(row.checkedAt);
      assert.ok(row.requestId);
    } else if (row.result === 'NOT_RUN') {
      assert.equal(row.observedHttp, null);
      assert.equal(row.requestId, null);
      assert.equal(row.checkedAt, null);
    }
  }
});

test('body tamper check cannot create a note even if protection is broken', async () => {
  const f = fixture();
  await runSafeEvidenceChecks(deps(f));
  const mutating = f.requests.filter(r => r.opt.method === 'POST');
  assert.equal(mutating.length, 2); // one unauth restore preview, one invalid-body POST
  const notePost = mutating.find(r => r.url === '/api/notes');
  assert.ok(notePost);
  assert.equal(JSON.parse(notePost.opt.body).title, '');
  assert.equal(f.requests.some(r => r.opt.method === 'DELETE' || r.opt.method === 'PUT'), false);
  assert.equal(JSON.parse(mutating.find(r=>r.url==='/api/restore-note').opt.body).confirm, false);
});

test('reports never contain response bodies or credentials', async () => {
  const f = fixture();
  const report = await runSafeEvidenceChecks(deps(f));
  assert.ok(!('credentials' in report));
  assert.doesNotMatch(JSON.stringify(report), /privateKey|access_token|password|bearer|"notes"\s*:|"body"\s*:/i);
  assert.deepEqual(Object.keys(report.rows[0]).sort(),
    ['caseId','step','scenario','expected','observedHttp','requestId','checkedAt','result','detail'].sort());
});

test('network failures cannot become false PASS or zero', async () => {
  const report = await runSafeEvidenceChecks({
    fetchImpl: async () => { throw Error('NETWORK'); },
    signedHeaders: async () => ({ testing: 'fixture' }),
    newId: () => 'fixture-uuid', now: () => '2026-10-14T14:01:00.000Z'
  });
  assert.equal(report.counts.match, 0);
  assert.ok(report.counts.unavailable > 0);
  assert.equal(report.rows.find(r=>r.caseId==='S05_OWNER_READ').observedHttp, null);
});

test('integrated UI is isolated from existing authentication and uses DOM text', async () => {
  const html = await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(html, /id="ops-evidence-section"/);
  assert.match(html, /runSafeEvidenceChecks/);
  assert.match(html, /evidenceSection.hidden = !loggedIn \|\| !deviceReady/);
  assert.match(html, /td\.textContent =/);
  assert.match(html, /const deviceClient = createDeviceClient\(\)/);
});
