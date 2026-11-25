import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { plannerRequest } from '../lib/planner-request.mjs';
import { emptyYear, sameYear, yearPayload, positiveId, apiError, academicSetupApiUrl } from '../lib/academic-setup.mjs';
import { allowedRequest, plannerTarget, plannerAuth } from '../lib/academic-setup-proxy.mjs';

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
test('proxy only permits academic setup operations', () => {
 assert.equal(allowedRequest(['holidays', '7'], 'DELETE'), true);
 for (const [path, method] of [['boards', 'POST'], ['holidays/../boards', 'DELETE'], ['syllabus-plan/7', 'PATCH'], ['anything', 'GET']]) assert.equal(allowedRequest(path.split('/'), method), false);
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
