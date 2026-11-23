export const emptyYear = () => ({ board_id: '', calendar_id: '', academic_year: '2026-27', start_date: '2026-06-01', end_date: '2027-04-30' });
export const yearFields = ['board_id', 'calendar_id', 'academic_year', 'start_date', 'end_date'];
export const sameYear = (a, b) => !!a && !!b && yearFields.every(key => String(a[key]) === String(b[key]));
export const positiveId = value => /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value));
export function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function yearPayload(year) {
  if (!positiveId(year.board_id) || !positiveId(year.calendar_id)) throw Error('Choose a configured board and calendar.');
  const match = /^(\d{4})-(\d{2})$/.exec(year.academic_year);
  if (!match || Number(match[2]) !== (Number(match[1]) + 1) % 100) throw Error('Use consecutive academic years, for example 2026-27.');
  if (!isDate(year.start_date) || !isDate(year.end_date) || year.start_date > year.end_date) throw Error('Enter valid start and end dates in chronological order.');
  return Object.fromEntries(yearFields.map(key => [key, key.endsWith('_id') ? Number(year[key]) : year[key]]));
}
export function apiError(body, status) {
  if (status === 401 || status === 403) return 'Your planner session is missing, expired or not authorised. Please sign in with an Admin or Headmaster account.';
  if (typeof body?.detail === 'string') return body.detail;
  if (Array.isArray(body?.detail)) return body.detail.map(error => `${(error.loc || []).filter(part => part !== 'body').join('.')}: ${error.msg}`).join('; ');
  return 'The planner service could not complete this request. Please try again.';
}
