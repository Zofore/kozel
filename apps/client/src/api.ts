export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3005').replace(/\/$/, '');
export async function apiFetch(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  const token = localStorage.getItem('kozel_token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}
export async function checkedJson(url: string, options?: RequestInit) {
  const response = await apiFetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Ошибка сервера');
  return data;
}
