async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401) {
    location.replace('/');
    throw new Error('Session expirée');
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

export const api = {
  logout: () => request('POST', '/api/logout'),

  listClients: () => request('GET', '/api/clients'),
  getClient: (id) => request('GET', `/api/clients/${id}`),
  createClient: (payload) => request('POST', '/api/clients', payload),
  updateClient: (id, payload) => request('PUT', `/api/clients/${id}`, payload),
  deleteClient: (id) => request('DELETE', `/api/clients/${id}`),

  listProviders: (filters = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return request('GET', `/api/providers${qs ? `?${qs}` : ''}`);
  },
  createProvider: (payload) => request('POST', '/api/providers', payload),
  updateProvider: (id, payload) => request('PUT', `/api/providers/${id}`, payload),
  deleteProvider: (id) => request('DELETE', `/api/providers/${id}`),

  listQuotes: (clientId) => request('GET', `/api/clients/${clientId}/quotes`),
  createQuote: (clientId, payload = {}) => request('POST', `/api/clients/${clientId}/quotes`, payload),
  getQuote: (id) => request('GET', `/api/quotes/${id}`),
  saveQuote: (id, payload) => request('PUT', `/api/quotes/${id}`, payload),
  branchQuote: (id) => request('POST', `/api/quotes/${id}/version`),
  deleteQuote: (id) => request('DELETE', `/api/quotes/${id}`),
};

export const usd = (value) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);

export const eur = (value) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);

export const frDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d ? `${d}/${m}/${y}` : iso;
};
