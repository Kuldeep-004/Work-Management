export const API_BASE_URL = "http://localhost:5000"; 
//export const API_BASE_URL = "https://api.haacas.com"

export async function fetchTabState(tabKey, token) {
  const res = await fetch(`${API_BASE_URL}/api/users/user-tab-state/${encodeURIComponent(tabKey)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch tab state');
  const data = await res.json();
  if (!data || typeof data !== 'object') return null;
  return data;
}

export async function saveTabState(tabKey, state, token) {
  const res = await fetch(`${API_BASE_URL}/api/users/user-tab-state/${encodeURIComponent(tabKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ state }),
  });
  if (!res.ok) throw new Error('Failed to save tab state');
  const data = await res.json();
  if (!data || typeof data !== 'object') return null;
  return data;
}