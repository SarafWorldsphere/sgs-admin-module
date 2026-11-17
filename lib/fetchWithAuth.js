export const fetchWithAuth = async (url, options = {}) => {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;

  const headers = { ...options.headers };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      const clone = response.clone();
      let errorData = {};
      try { errorData = await clone.json(); } catch (e) {}

      // Only redirect if it's explicitly a token error
      if (errorData.error && errorData.error.toLowerCase().includes('token')) {
        console.warn('🔒 Session expired. Redirecting to login.');
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('admin_token');
          window.location.replace(process.env.NEXT_PUBLIC_LOGIN_PORTAL_URL || 'https://staging.sgs.swais.in');
        }
        throw new Error('Unauthorized');
      }
    }
    
    // For 500 errors (like DB crashes), pass the response back so the UI can show "Load Failed"
    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};