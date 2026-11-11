export const fetchWithAuth = async (url, options = {}) => {
  // Get the token from sessionStorage
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;

  // Prepare headers
  const headers = {
    ...options.headers,
  };

  // If we have a token, attach it
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Merge options
  const fetchOptions = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, fetchOptions);

    // Handle Unauthorized (Token expired or invalid)
    if (response.status === 401) {
      // Clear token and redirect to portal
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('admin_token');
        window.location.href = 'https://portal.swais.in'; // Update with your actual portal URL
      }
      return response;
    }

    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};