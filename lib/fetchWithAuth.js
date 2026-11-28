// lib/fetchWithAuth.js

export async function fetchWithAuth(url, options = {}) {
  // Get the token from sessionStorage (set during login)
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;

  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }

  return response.json();
}