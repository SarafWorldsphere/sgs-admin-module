export function allowedRequest(parts, method) {
  const path = parts.join('/');
  return (method === 'GET' && ['boards', 'calendars', 'academic-year', 'holidays'].includes(path)) ||
    (method === 'POST' && ['academic-year', 'holidays', 'syllabus-plan/generate'].includes(path)) ||
    (method === 'DELETE' && /^holidays\/[1-9]\d*$/.test(path));
}
export function plannerTarget(raw) {
  if (!raw) throw Error('SYLLABUS_PLANNER_API_URL is not configured.');
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw Error('Planner API URL is invalid.');
  return url;
}
export function plannerAuth({ env, target, authorization, cookie }) {
  if (env.NODE_ENV === 'development' && env.SYLLABUS_PLANNER_DEV_AUTH === 'true' && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) return 'Bearer dev-admin';
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : cookie;
  if (!token || token.startsWith('dev-')) return null;
  return `Bearer ${token}`;
}
