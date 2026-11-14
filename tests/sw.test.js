// Prüft die Logik des Service Workers mit einer Attrappe der Browser-Umgebung,
// weil der Service Worker im Preview-Browser nicht läuft.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const ORIGIN = 'http://app.test';
const abs = (u) => new URL(typeof u === 'string' ? u : u.url, `${ORIGIN}/`).href;

let online = true;
let version = 1;
const listeners = {};
const stores = new Map();

class FakeCache {
  constructor() { this.map = new Map(); }
  async addAll(urls) { for (const u of urls) { const res = await globalThis.fetch(u); if (!res.ok) throw new Error(`addAll ${u}`); this.map.set(abs(u), res); } }
  async put(req, res) { this.map.set(abs(req), res); }
  async match(req) { const hit = this.map.get(abs(req)) ?? this.map.get(abs(req).split('?')[0]); return hit ? hit.clone() : undefined; }
}

globalThis.self = {
  location: { origin: ORIGIN },
  skipWaiting: async () => {},
  clients: { claim: async () => {} },
  addEventListener: (type, fn) => { listeners[type] = fn; },
};
globalThis.caches = {
  open: async (name) => { if (!stores.has(name)) stores.set(name, new FakeCache()); return stores.get(name); },
  keys: async () => [...stores.keys()],
  delete: async (name) => stores.delete(name),
};
globalThis.fetch = async (u) => {
  if (!online) throw new TypeError('offline');
  const url = abs(u);
  if (url.endsWith('data/units/index.json')) return new Response(JSON.stringify(['u1.json']));
  return new Response(`v${version}:${new URL(url).pathname}`, { status: 200 });
};

await import('../app/sw.js');

async function dispatch(type, request) {
  const waits = [];
  const ev = { request, waitUntil: (p) => waits.push(p), respondWith(p) { this.response = p; } };
  listeners[type](ev);
  const response = ev.response ? await ev.response : undefined;
  await Promise.all(waits);
  return { handled: !!ev.response, response };
}

const get = (path, init = {}) => {
  const r = new Request(`${ORIGIN}${path}`, init);
  return r;
};

test('install: Programmdateien und Wortlisten kommen in den Speicher', async () => {
  await dispatch('install');
  const cache = stores.get('frenchfox-app');
  for (const path of ['/index.html', '/js/main.js', '/css/theme.css', '/data/units/index.json', '/data/units/u1.json', '/manifest.webmanifest']) {
    assert.ok(await cache.match(`${ORIGIN}${path}`), `nicht im Speicher: ${path}`);
  }
});

test('offline: Dateien kommen aus dem Speicher', async () => {
  online = false;
  const { handled, response } = await dispatch('fetch', get('/js/main.js'));
  assert.ok(handled);
  assert.equal(await response.text(), 'v1:/js/main.js');
});

test('online: Antwort kommt sofort aus dem Speicher, der Speicher wird im Hintergrund erneuert', async () => {
  online = true;
  version = 2;
  const first = await dispatch('fetch', get('/js/main.js'));
  assert.equal(await first.response.text(), 'v1:/js/main.js'); // alter Stand
  const second = await dispatch('fetch', get('/js/main.js'));
  assert.equal(await second.response.text(), 'v2:/js/main.js'); // beim nächsten Mal neu
});

test('offline: Seitenaufruf mit Parametern zeigt die Startseite', async () => {
  online = false;
  // Node erlaubt mode «navigate» nicht in Request, darum ein einfaches Objekt
  const { response } = await dispatch('fetch', { url: `${ORIGIN}/unbekannte-seite?sw=1`, method: 'GET', mode: 'navigate' });
  assert.match(await response.text(), /index\.html/);
});

test('offline: unbekannte Datei gibt einen Fehler statt zu hängen', async () => {
  online = false;
  const { response } = await dispatch('fetch', get('/gibt-es-nicht.png'));
  assert.equal(response.type, 'error');
});

test('nicht angefasst werden: POST, fremde Adressen, Sprachtest', async () => {
  online = true;
  assert.equal((await dispatch('fetch', get('/x', { method: 'POST' }))).handled, false);
  assert.equal((await dispatch('fetch', new Request('https://fremd.example/x.js'))).handled, false);
  assert.equal((await dispatch('fetch', get('/test_speech.html'))).handled, false);
});

test('activate: alte Speicher werden entfernt, der aktuelle bleibt', async () => {
  stores.set('voci-alt', new FakeCache());
  await dispatch('activate');
  assert.deepEqual([...stores.keys()], ['frenchfox-app']);
});
