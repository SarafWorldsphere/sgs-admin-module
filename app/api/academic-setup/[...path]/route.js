import { allowedRequest, plannerTarget, plannerAuth, plannerQuery } from '../../../../lib/academic-setup-proxy.mjs';
import { plannerRequest } from '../../../../lib/planner-request.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function proxy(request, context) {
  const { path = [] } = await context.params;
  if (!allowedRequest(path, request.method)) return Response.json({ detail: 'Planner operation not found.' }, { status: 404 });
  let target;
  try { target = plannerTarget(process.env.SYLLABUS_PLANNER_API_URL); }
  catch (error) { return Response.json({ detail: error.message }, { status: 503 }); }
  const authorization = plannerAuth({ env: process.env, target, authorization: request.headers.get('authorization'), cookie: request.cookies.get('admin_token')?.value });
  if (!authorization) return Response.json({ detail: 'Planner authentication required.' }, { status: 401 });
  const upstream = new URL(`${target.pathname.replace(/\/$/, '')}/${path.join('/')}`, target.origin);
  const incoming = new URL(request.url);
  upstream.search = plannerQuery(path, incoming.searchParams).toString();
  const host = request.headers.get('host') || incoming.host;
  try {
    const response = await plannerRequest(upstream, {
      method: request.method,
      headers: { Authorization: authorization, 'Content-Type': 'application/json', Host: host, 'X-Forwarded-Host': host },
      ...(['POST', 'PATCH'].includes(request.method) ? { body: await request.text() } : {}),
    });
    if (response.status === 204) return new Response(null, { status: 204 });
    let body;
    try { body = JSON.parse(response.text); }
    catch { body = { detail: 'Planner service returned an unexpected response.' }; }
    if (response.status >= 300 && response.status < 400) return Response.json({ detail: 'Planner service returned an unexpected redirect.' }, { status: 502 });
    if (response.status >= 500) return Response.json({ detail: 'Planner service is unavailable. Please contact the administrator.' }, { status: 502 });
    return Response.json(body, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ detail: 'Cannot reach the planner service. Check its URL and whether it is running.' }, { status: 502 });
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
