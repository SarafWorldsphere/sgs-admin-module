export const fetchWithAuth = async (url, options = {}) => {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;

  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, fetchOptions);

    if (response.status === 401) {
      console.warn('⚠️ 401 Unauthorized detected. Clearing session and redirecting...');
      
      if (typeof window !== 'undefined') {
        // 1. Clear the invalid token immediately
        sessionStorage.removeItem('admin_token');
        
        // 2. Change the actual URL to your real portal login page
        // (Make sure this is the CORRECT URL for your login portal)
        window.location.replace('https://staging.sgs.swais.in'); 
        // Note: If your actual portal login is a different domain, change it above. 
      }
      // We throw an error here to stop the component from trying to render the failed data
      throw new Error('Unauthorized');
    }

    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};