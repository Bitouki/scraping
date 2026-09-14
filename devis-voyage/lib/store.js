import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const EMPTY = { clients: [], providers: [], quotes: [] };

let db = null;

function load() {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    db = { ...EMPTY, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
  } else {
    db = structuredClone(EMPTY);
    persist();
  }
  return db;
}

// Write to a temp file then rename so a crash mid-write cannot truncate the database.
function persist() {
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

const now = () => new Date().toISOString();

/* ---------------------------------------------------------------- clients */

export function listClients() {
  const d = load();
  return d.clients
    .map((c) => ({
      ...c,
      quoteCount: d.quotes.filter((q) => q.clientId === c.id).length,
    }))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr'));
}

export function getClient(id) {
  return load().clients.find((c) => c.id === id) || null;
}

export function createClient({ firstName, lastName, email, phone, notes }) {
  const d = load();
  const client = {
    id: randomUUID(),
    firstName: firstName || '',
    lastName: lastName || '',
    email: email || '',
    phone: phone || '',
    notes: notes || '',
    createdAt: now(),
  };
  d.clients.push(client);
  persist();
  return client;
}

export function updateClient(id, patch) {
  const client = getClient(id);
  if (!client) return null;
  for (const key of ['firstName', 'lastName', 'email', 'phone', 'notes']) {
    if (key in patch) client[key] = patch[key];
  }
  persist();
  return client;
}

export function deleteClient(id) {
  const d = load();
  const i = d.clients.findIndex((c) => c.id === id);
  if (i === -1) return false;
  d.clients.splice(i, 1);
  d.quotes = d.quotes.filter((q) => q.clientId !== id);
  persist();
  return true;
}

/* ------------------------------------------------------------ prestataires */

export function listProviders({ search, type, city } = {}) {
  const needle = (search || '').trim().toLowerCase();
  return load()
    .providers.filter((p) => {
      if (type && p.type !== type) return false;
      if (city && p.city !== city) return false;
      if (!needle) return true;
      return `${p.name} ${p.type} ${p.city}`.toLowerCase().includes(needle);
    })
    .sort((a, b) => a.city.localeCompare(b.city, 'fr') || a.name.localeCompare(b.name, 'fr'));
}

export function providerFacets() {
  const providers = load().providers;
  const uniq = (key) => [...new Set(providers.map((p) => p[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  return { types: uniq('type'), cities: uniq('city') };
}

export function createProvider({ type, name, city, priceUsd, notes }) {
  const d = load();
  const provider = {
    id: randomUUID(),
    type: (type || '').trim(),
    name: (name || '').trim(),
    city: (city || '').trim(),
    priceUsd: Number(priceUsd) || 0,
    notes: notes || '',
    createdAt: now(),
  };
  d.providers.push(provider);
  persist();
  return provider;
}

export function updateProvider(id, patch) {
  const provider = load().providers.find((p) => p.id === id);
  if (!provider) return null;
  for (const key of ['type', 'name', 'city', 'notes']) {
    if (key in patch) provider[key] = String(patch[key]).trim();
  }
  if ('priceUsd' in patch) provider.priceUsd = Number(patch.priceUsd) || 0;
  persist();
  return provider;
}

export function deleteProvider(id) {
  const d = load();
  const i = d.providers.findIndex((p) => p.id === id);
  if (i === -1) return false;
  d.providers.splice(i, 1);
  persist();
  return true;
}

/* -------------------------------------------------------------------- devis */

const DEFAULT_HEADER = {
  firstName: '',
  lastName: '',
  startDate: '',
  endDate: '',
  exchangeRate: 0.92,
  marginPct: 10,
  title: '',
};

function normalizeDay(day, index) {
  return {
    id: day.id || randomUUID(),
    dayNumber: index + 1,
    date: day.date || '',
    city: day.city || '',
    title: day.title || '',
    description: day.description || '',
    hotel: day.hotel || '',
    activities: Array.isArray(day.activities) ? day.activities.filter((a) => String(a).trim()) : [],
    items: Array.isArray(day.items)
      ? day.items.map((it) => ({
          id: it.id || randomUUID(),
          providerId: it.providerId || null,
          type: it.type || '',
          name: it.name || '',
          city: it.city || '',
          priceUsd: Number(it.priceUsd) || 0,
          quantity: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
        }))
      : [],
  };
}

export function listQuotes(clientId) {
  const quotes = load().quotes.filter((q) => q.clientId === clientId);
  const groups = new Map();
  for (const q of quotes) {
    if (!groups.has(q.groupId)) groups.set(q.groupId, []);
    groups.get(q.groupId).push(q);
  }
  return [...groups.values()]
    .map((versions) => {
      versions.sort((a, b) => b.version - a.version);
      return {
        groupId: versions[0].groupId,
        latestVersion: versions[0].version,
        versions: versions.map((q) => ({
          id: q.id,
          version: q.version,
          title: q.header.title,
          startDate: q.header.startDate,
          endDate: q.header.endDate,
          createdAt: q.createdAt,
          total: computeTotals(q).finalEur,
          editable: q.version === versions[0].version,
        })),
      };
    })
    .sort((a, b) => new Date(b.versions[0].createdAt) - new Date(a.versions[0].createdAt));
}

export function getQuote(id) {
  const d = load();
  const quote = d.quotes.find((q) => q.id === id);
  if (!quote) return null;
  const siblings = d.quotes.filter((q) => q.groupId === quote.groupId);
  const latest = Math.max(...siblings.map((q) => q.version));
  return {
    ...quote,
    editable: quote.version === latest,
    versions: siblings
      .map((q) => ({ id: q.id, version: q.version, createdAt: q.createdAt }))
      .sort((a, b) => b.version - a.version),
  };
}

export function createQuote(clientId, payload = {}) {
  const d = load();
  const client = getClient(clientId);
  if (!client) return null;
  const quote = {
    id: randomUUID(),
    clientId,
    groupId: randomUUID(),
    version: 1,
    createdAt: now(),
    header: {
      ...DEFAULT_HEADER,
      firstName: client.firstName,
      lastName: client.lastName,
      ...(payload.header || {}),
    },
    days: (payload.days || []).map(normalizeDay),
  };
  d.quotes.push(quote);
  persist();
  return getQuote(quote.id);
}

export function saveQuote(id, payload) {
  const quote = load().quotes.find((q) => q.id === id);
  if (!quote) return null;
  const stored = getQuote(id);
  if (!stored.editable) return { locked: true };
  quote.header = { ...DEFAULT_HEADER, ...quote.header, ...(payload.header || {}) };
  quote.header.exchangeRate = Number(quote.header.exchangeRate) || 0;
  quote.header.marginPct = Number(quote.header.marginPct) || 0;
  quote.days = (payload.days || []).map(normalizeDay);
  quote.updatedAt = now();
  persist();
  return getQuote(id);
}

/** A new version is a full copy: earlier versions stay frozen exactly as sent. */
export function branchQuote(id) {
  const d = load();
  const source = d.quotes.find((q) => q.id === id);
  if (!source) return null;
  const latest = Math.max(...d.quotes.filter((q) => q.groupId === source.groupId).map((q) => q.version));
  const copy = structuredClone(source);
  copy.id = randomUUID();
  copy.version = latest + 1;
  copy.createdAt = now();
  delete copy.updatedAt;
  copy.days = copy.days.map((day) => ({
    ...day,
    id: randomUUID(),
    items: day.items.map((it) => ({ ...it, id: randomUUID() })),
  }));
  d.quotes.push(copy);
  persist();
  return getQuote(copy.id);
}

export function deleteQuote(id) {
  const d = load();
  const i = d.quotes.findIndex((q) => q.id === id);
  if (i === -1) return false;
  d.quotes.splice(i, 1);
  persist();
  return true;
}

export function computeTotals(quote) {
  const rate = Number(quote.header?.exchangeRate) || 0;
  const margin = Number(quote.header?.marginPct) || 0;
  const totalUsd = (quote.days || []).reduce(
    (sum, day) => sum + day.items.reduce((s, it) => s + Number(it.priceUsd) * (Number(it.quantity) || 1), 0),
    0,
  );
  const grossEur = totalUsd * rate;
  const marginEur = grossEur * (margin / 100);
  return {
    totalUsd,
    grossEur,
    marginPct: margin,
    marginEur,
    finalEur: grossEur + marginEur,
  };
}
