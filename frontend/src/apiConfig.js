// Central API config for backend URL
//export const API_BASE_URL = "http://localhost:5000"; 
export const API_BASE_URL = "https://api.haacas.com"

// Utility for per-user, per-tab state
export async function fetchTabState(tabKey, token) {
  const res = await fetch(`${API_BASE_URL}/api/users/user-tab-state/${encodeURIComponent(tabKey)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch tab state');
  return await res.json();
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
  return await res.json();
}