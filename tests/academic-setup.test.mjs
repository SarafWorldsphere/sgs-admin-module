import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { plannerRequest } from '../lib/planner-request.mjs';
import { emptyYear, sameYear, yearPayload, positiveId, apiError, academicSetupApiUrl } from '../lib/academic-setup.mjs';
import { allowedRequest, plannerTarget, plannerAuth, plannerQuery } from '../lib/academic-setup-proxy.mjs';
import { GET, PATCH } from '../app/api/academic-setup/[...path]/route.js';

test('Academic Setup API URLs follow the configured mount point', () => {
 assert.equal(academicSetupApiUrl('boards', '/admin'), '/admin/api/academic-setup/boards');
 assert.equal(academicSetupApiUrl('holidays/7', '/school/admin/'), '/school/admin/api/academic-setup/holidays/7');
 assert.equal(academicSetupApiUrl('academic-year', ''), '/api/academic-setup/academic-year');
 const config = createRequire(import.meta.url)('../next.config.js');
 assert.equal(config.env.NEXT_PUBLIC_APP_BASE_PATH, config.basePath || '');
});

test('planner transport preserves the school Host instead of the upstream host', async () => {
 const server = createServer((request, response) => response.end(JSON.stringify({ host: request.headers.host, authorization: request.headers.authorization })));
 server.listen(0, '127.0.0.1');
 await once(server, 'listening');
 try {
  const result = await plannerRequest(new URL(`http://127.0.0.1:${server.address().port}/api/v1/boards`), { method: 'GET', headers: { Host: 'sss-test.swais.in', Authorization: 'Bearer local-test' } });
  assert.deepEqual(JSON.parse(result.text), { host: 'sss-test.swais.in', authorization: 'Bearer local-test' });
 } finally { await new Promise(resolve => server.close(resolve)); }
});
test('year IDs are numeric and calendars are independent of boards', () => {
 const input = { ...emptyYear(), board_id: '7', calendar_id: '19' };
 assert.equal(yearPayload(input).board_id, 7);
 assert.equal(yearPayload(input).calendar_id, 19);
 assert.equal(yearPayload({ ...input, board_id: '9' }).calendar_id, 19);
 assert.equal(sameYear(input, { ...input, board_id: 7 }), true);
 assert.equal(sameYear(input, { ...input, end_date: '2027-04-29' }), false);
});
test('invalid dates, year labels and IDs are rejected before persistence', () => {
 const valid = { ...emptyYear(), board_id: 1, calendar_id: 1 };
 for (const change of [{ board_id: 0 }, { calendar_id: '1x' }, { start_date: '2026-02-30' }, { academic_year: '2026-29' }, { end_date: '2025-01-01' }]) assert.throws(() => yearPayload({ ...valid, ...change }));
 for (const id of ['-1', '0', '1.5', '9007199254740992']) assert.equal(positiveId(id), false);
});
test('proxy only permits the supported academic setup and syllabus plan operations', () => {
 assert.equal(allowedRequest(['holidays', '7'], 'DELETE'), true);
 assert.equal(allowedRequest(['syllabus-plan', 'unmatched'], 'GET'), true);
 assert.equal(allowedRequest(['syllabus-plan', '7'], 'PATCH'), true);
 for (const [path, method] of [['boards', 'POST'], ['holidays/../boards', 'DELETE'], ['syllabus-plan/0', 'PATCH'], ['syllabus-plan/unmatched', 'PATCH'], ['syllabus-plan/7', 'DELETE'], ['syllabus-plan/7', 'POST'], ['anything', 'GET']]) assert.equal(allowedRequest(path.split('/'), method), false);
});
test('query filters are forwarded only to their supported operation', () => {
 const incoming = new URLSearchParams('class_id=34&subject_id=60&academic_year=2026-27&region=AP&tenant_id=other&token=ignored');
 assert.equal(plannerQuery(['syllabus-plan', 'unmatched'], incoming).toString(), 'class_id=34&subject_id=60');
 assert.equal(plannerQuery(['calendars'], incoming).toString(), 'academic_year=2026-27&region=AP');
 assert.equal(plannerQuery(['syllabus-plan', '7'], incoming).toString(), '');
 assert.equal(plannerQuery(['boards'], incoming).toString(), '');
});
test('route forwards unmatched filters and PATCH payload with the school and session', async () => {
 const calls = [];
 const server = createServer(async (request, response) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  calls.push({ path: request.url, method: request.method, body, host: request.headers.host, authorization: request.headers.authorization });
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify({ ok: true }));
 });
 server.listen(0, '127.0.0.1');
 await once(server, 'listening');
 const previous = process.env.SYLLABUS_PLANNER_API_URL;
 process.env.SYLLABUS_PLANNER_API_URL = `http://127.0.0.1:${server.address().port}/api/v1`;
 try {
  const request = (url, method, body, authenticated = true) => Object.assign(new Request(url, {
   method, headers: { Host: 'sss-test.swais.in', ...(authenticated ? { Authorization: 'Bearer test-session' } : {}) }, ...(body ? { body } : {}),
  }), { cookies: { get: () => undefined } });
  const list = await GET(request('https://sss-test.swais.in/admin/api/academic-setup/syllabus-plan/unmatched?class_id=34&subject_id=60&tenant_id=other', 'GET'), { params: Promise.resolve({ path: ['syllabus-plan', 'unmatched'] }) });
  assert.equal(list.status, 200);
  const body = JSON.stringify({ chapter_id: 104, version_no: 1, is_active: true });
  const saved = await PATCH(request('https://sss-test.swais.in/admin/api/academic-setup/syllabus-plan/7', 'PATCH', body), { params: Promise.resolve({ path: ['syllabus-plan', '7'] }) });
  assert.equal(saved.status, 200);
  assert.deepEqual(calls, [
   { path: '/api/v1/syllabus-plan/unmatched?class_id=34&subject_id=60', method: 'GET', body: '', host: 'sss-test.swais.in', authorization: 'Bearer test-session' },
   { path: '/api/v1/syllabus-plan/7', method: 'PATCH', body, host: 'sss-test.swais.in', authorization: 'Bearer test-session' },
  ]);
  const denied = await PATCH(request('https://sss-test.swais.in/admin/api/academic-setup/syllabus-plan/7', 'PATCH', body, false), { params: Promise.resolve({ path: ['syllabus-plan', '7'] }) });
  assert.equal(denied.status, 401);
  assert.equal(calls.length, 2);
 } finally {
  if (previous === undefined) delete process.env.SYLLABUS_PLANNER_API_URL;
  else process.env.SYLLABUS_PLANNER_API_URL = previous;
  await new Promise(resolve => server.close(resolve));
 }
});
test('development stand-in cannot leak into production or remote upstream', () => {
 const local = plannerTarget('http://127.0.0.1:8010/api/v1');
 const args = { env: { NODE_ENV: 'development', SYLLABUS_PLANNER_DEV_AUTH: 'true' }, target: local };
 assert.equal(plannerAuth(args), 'Bearer dev-admin');
 assert.equal(plannerAuth({ ...args, env: { ...args.env, NODE_ENV: 'production' } }), null);
 assert.equal(plannerAuth({ ...args, target: plannerTarget('https://planner.example/api/v1') }), null);
 assert.equal(plannerAuth({ ...args, env: {}, cookie: 'dev-admin' }), null);
 assert.equal(plannerAuth({ ...args, env: {}, cookie: 'signed-cookie' }), 'Bearer signed-cookie');
 assert.equal(plannerAuth({ ...args, env: {}, cookie: 'old-cookie', authorization: 'Bearer current-token' }), 'Bearer current-token');
});
test('configuration and API errors remain actionable', () => {
 assert.throws(() => plannerTarget(''));
 assert.throws(() => plannerTarget('file:///tmp/planner'));
 assert.match(apiError(null, 401), /session/);
 assert.match(apiError({ detail: [{ loc: ['body', 'board_id'], msg: 'required' }] }, 422), /board_id: required/);
});
