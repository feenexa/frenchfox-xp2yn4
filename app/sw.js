// Service Worker: macht die App offlinefähig.
// Strategie: zuerst aus dem Zwischenspeicher antworten, im Hintergrund aktualisieren.
// Neue Versionen erscheinen dadurch beim nächsten Öffnen der App (nach einmal Neuladen).
// Läuft nur über HTTPS oder localhost (Vorgabe der Browser).

const CACHE = 'frenchfox-app'; // alte Speicher mit anderem Namen werden beim Aktivieren gelöscht

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/theme.css',
  'js/main.js',
  'js/ui.js',
  'js/quiz.js',
  'js/srs.js',
  'js/score.js',
  'js/store.js',
  'js/speech.js',
  'js/prep.js',
  'js/help.js',
  'js/views/homeView.js',
  'js/views/quizView.js',
  'js/views/resultView.js',
  'js/views/prepView.js',
  'js/views/probeView.js',
  'js/views/helpView.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'data/units/index.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    // Wortlisten stehen in index.json
    const names = await (await fetch('data/units/index.json', { cache: 'no-store' })).json();
    await cache.addAll(names.map((n) => `data/units/${n}`));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/test_speech.html')) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const refresh = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    if (cached) {
      event.waitUntil(refresh);
      return cached;
    }
    const res = await refresh;
    if (res) return res;
    // Offline und nicht im Speicher: für Seitenaufrufe die Startseite zeigen
    if (req.mode === 'navigate') return (await cache.match('index.html')) ?? Response.error();
    return Response.error();
  })());
});
