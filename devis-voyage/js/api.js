/** Toutes les URL sont relatives : le logiciel marche à la racine comme dans un sous-dossier. */
async function request(method, route, body) {
  let res;
  try {
    res = await fetch(`api.php?${route}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Le serveur ne répond pas. Vérifiez votre connexion.');
  }

  if (res.status === 401) {
    location.replace('index.php');
    throw new Error('Session expirée');
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

const query = (params) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return search.toString();
};

export const api = {
  logout: () => request('POST', 'p=logout'),

  listClients: () => request('GET', 'p=clients'),
  getClient: (id) => request('GET', `p=client&id=${id}`),
  createClient: (payload) => request('POST', 'p=clients', payload),
  updateClient: (id, payload) => request('PUT', `p=client&id=${id}`, payload),
  deleteClient: (id) => request('DELETE', `p=client&id=${id}`),

  listProviders: (filters = {}) => request('GET', `p=providers&${query(filters)}`),
  createProvider: (payload) => request('POST', 'p=providers', payload),
  updateProvider: (id, payload) => request('PUT', `p=provider&id=${id}`, payload),
  deleteProvider: (id) => request('DELETE', `p=provider&id=${id}`),

  listQuotes: (clientId) => request('GET', `p=quotes&client=${clientId}`),
  createQuote: (clientId, payload = {}) => request('POST', `p=quotes&client=${clientId}`, payload),
  getQuote: (id) => request('GET', `p=quote&id=${id}`),
  saveQuote: (id, payload) => request('PUT', `p=quote&id=${id}`, payload),
  branchQuote: (id) => request('POST', `p=quote_version&id=${id}`),
  deleteQuote: (id) => request('DELETE', `p=quote&id=${id}`),
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
