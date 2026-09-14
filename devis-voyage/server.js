import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as auth from './lib/auth.js';
import * as store from './lib/store.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 5_000_000) throw new Error('Payload trop volumineux');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const target = path.join(PUBLIC_DIR, rel);
  if (!target.startsWith(PUBLIC_DIR + path.sep) && target !== PUBLIC_DIR) {
    return send(res, 403, { error: 'Interdit' });
  }
  fs.readFile(target, (err, data) => {
    if (err) return send(res, 404, { error: 'Introuvable' });
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

async function handleApi(req, res, pathname, url) {
  const method = req.method;
  const segments = pathname.split('/').filter(Boolean).slice(1); // strip "api"

  if (segments[0] === 'login' && method === 'POST') {
    const { email, password } = await readBody(req);
    const token = auth.login(email, password);
    if (!token) return send(res, 401, { error: 'Identifiants incorrects' });
    return send(res, 200, { ok: true }, { 'Set-Cookie': auth.sessionCookie(token) });
  }

  if (segments[0] === 'logout' && method === 'POST') {
    auth.logout(auth.readToken(req));
    return send(res, 200, { ok: true }, { 'Set-Cookie': auth.clearCookie() });
  }

  if (segments[0] === 'session' && method === 'GET') {
    return send(res, 200, { authenticated: auth.isAuthenticated(req) });
  }

  if (!auth.isAuthenticated(req)) return send(res, 401, { error: 'Non authentifié' });

  /* clients */
  if (segments[0] === 'clients') {
    const [, id, sub] = segments;
    if (!id && method === 'GET') return send(res, 200, store.listClients());
    if (!id && method === 'POST') return send(res, 201, store.createClient(await readBody(req)));

    if (id && sub === 'quotes') {
      if (method === 'GET') return send(res, 200, store.listQuotes(id));
      if (method === 'POST') {
        const quote = store.createQuote(id, await readBody(req));
        if (!quote) return send(res, 404, { error: 'Client introuvable' });
        return send(res, 201, quote);
      }
    }

    if (id && !sub) {
      if (method === 'GET') {
        const client = store.getClient(id);
        return client ? send(res, 200, client) : send(res, 404, { error: 'Client introuvable' });
      }
      if (method === 'PUT') {
        const client = store.updateClient(id, await readBody(req));
        return client ? send(res, 200, client) : send(res, 404, { error: 'Client introuvable' });
      }
      if (method === 'DELETE') {
        return store.deleteClient(id) ? send(res, 204) : send(res, 404, { error: 'Client introuvable' });
      }
    }
  }

  /* prestataires */
  if (segments[0] === 'providers') {
    const id = segments[1];
    if (!id && method === 'GET') {
      return send(res, 200, {
        providers: store.listProviders({
          search: url.searchParams.get('search'),
          type: url.searchParams.get('type'),
          city: url.searchParams.get('city'),
        }),
        facets: store.providerFacets(),
      });
    }
    if (!id && method === 'POST') {
      const body = await readBody(req);
      if (!body.name || !body.city) return send(res, 400, { error: 'Nom et ville obligatoires' });
      return send(res, 201, store.createProvider(body));
    }
    if (id && method === 'PUT') {
      const provider = store.updateProvider(id, await readBody(req));
      return provider ? send(res, 200, provider) : send(res, 404, { error: 'Prestataire introuvable' });
    }
    if (id && method === 'DELETE') {
      return store.deleteProvider(id) ? send(res, 204) : send(res, 404, { error: 'Prestataire introuvable' });
    }
  }

  /* devis */
  if (segments[0] === 'quotes') {
    const [, id, sub] = segments;
    if (id && sub === 'version' && method === 'POST') {
      const quote = store.branchQuote(id);
      return quote ? send(res, 201, quote) : send(res, 404, { error: 'Devis introuvable' });
    }
    if (id && !sub) {
      if (method === 'GET') {
        const quote = store.getQuote(id);
        if (!quote) return send(res, 404, { error: 'Devis introuvable' });
        return send(res, 200, {
          ...quote,
          client: store.getClient(quote.clientId),
          totals: store.computeTotals(quote),
        });
      }
      if (method === 'PUT') {
        const result = store.saveQuote(id, await readBody(req));
        if (!result) return send(res, 404, { error: 'Devis introuvable' });
        if (result.locked) {
          return send(res, 409, { error: 'Cette version est archivée. Créez une nouvelle version pour la modifier.' });
        }
        return send(res, 200, { ...result, totals: store.computeTotals(result) });
      }
      if (method === 'DELETE') {
        return store.deleteQuote(id) ? send(res, 204) : send(res, 404, { error: 'Devis introuvable' });
      }
    }
  }

  return send(res, 404, { error: 'Route inconnue' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (pathname.startsWith('/api/')) return await handleApi(req, res, pathname, url);

    // Pages applicatives: renvoyer vers la connexion tant que la session n'est pas ouverte.
    if ((pathname === '/app' || pathname === '/print') && !auth.isAuthenticated(req)) {
      res.writeHead(302, { Location: '/' });
      return res.end();
    }
    if (pathname === '/app') return serveStatic(req, res, '/app.html');
    if (pathname === '/print') return serveStatic(req, res, '/print.html');

    return serveStatic(req, res, pathname);
  } catch (err) {
    send(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Devis Voyage — http://localhost:${PORT}`);
});
