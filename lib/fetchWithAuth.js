export async function fetchWithAuth(url, options = {}) {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
  
  const headers = {
    ...options.headers,
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };

  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401) {
    // Token expired, redirect to portal
    window.location.href = process.env.NEXT_PUBLIC_LOGIN_PORTAL_URL || 'https://staging.sgs.swais.in';
  }
  
  return response;
}