import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, memoryStorage, emptyData, migrate, STORAGE_KEY, VERSION } from '../app/js/store.js';

const mk = (storage = memoryStorage()) => ({ storage, store: createStore({ storage, persistent: true }) });

test('Speicherschlüssel bleibt «voci.data», damit der Fortschritt bei der Umbenennung zu FrenchFox erhalten bleibt', () => {
  assert.equal(STORAGE_KEY, 'voci.data');
});

test('leerer Start liefert Standarddaten', () => {
  const { store } = mk();
  assert.deepEqual(store.get(), emptyData());
});

test('update speichert und wird beim nächsten Start geladen', () => {
  const { storage, store } = mk();
  assert.equal(store.update((d) => ({ ...d, points: 42 })), true);
  const again = createStore({ storage, persistent: true });
  assert.equal(again.get().points, 42);
});

test('beschädigte Daten führen zu Standarddaten statt zu einem Absturz', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, '{kaputt');
  assert.deepEqual(createStore({ storage, persistent: true }).get(), emptyData());
});

test('Speichern schlägt fehl (voll/gesperrt): update meldet false, App läuft weiter', () => {
  const storage = { getItem: () => null, setItem() { throw new Error('voll'); }, removeItem() {} };
  const store = createStore({ storage, persistent: true });
  assert.equal(store.update((d) => ({ ...d, points: 5 })), false);
  assert.equal(store.get().points, 5);
});

test('migrate füllt fehlende Felder und ignoriert Unsinn', () => {
  assert.deepEqual(migrate(null), emptyData());
  const m = migrate({ version: 1, srs: 'x', settings: { sound: false } });
  assert.deepEqual(m.srs, {});
  assert.equal(m.settings.sound, false);
  assert.equal(m.settings.direction, 'de-fr');
  assert.equal(m.version, VERSION);
});

test('Version 1 → 2: das erreichte Level bleibt, Punkte werden auf die neue Schwelle gesetzt', () => {
  // 1000 Punkte = altes Level 5 (Vokabel-Profi) → neu 2500 Punkte (Level 5)
  assert.equal(migrate({ version: 1, srs: {}, points: 1000 }).points, 2500);
  assert.equal(migrate({ version: 1, srs: {}, points: 1499 }).points, 2500);
  assert.equal(migrate({ version: 1, srs: {}, points: 1500 }).points, 4500); // altes Level 6
  assert.equal(migrate({ version: 1, srs: {}, points: 50 }).points, 50); // Level 1 bleibt
  assert.equal(migrate({ srs: {}, points: 700 }).points, 1200); // ohne Version = Version 1 (altes Level 4 → 1200)
  // Version 2 wird nicht noch einmal angehoben
  assert.equal(migrate({ version: 2, srs: {}, points: 1000 }).points, 1000);
});

test('Version 2 → 3: Wort-IDs und Bereiche der Unité 2 bekommen die neuen Namen, der Rest bleibt', () => {
  const raw = {
    version: 2,
    points: 2500,
    srs: { 'lz2-01|de-fr': { box: 3, seen: 2 }, 'lz3-22|fr-de': { box: 1, seen: 1 }, 'u3-lz1-01|de-fr': { box: 2, seen: 1 } },
    prep: { scopes: ['lz02-03/lz2', 'u3/lz1'], date: '2026-11-20', streak: { 'lz2-05|fr-de': 2 }, lastProbe: null },
    settings: { scope: 'lz02-03/lz3' },
  };
  const m = migrate(raw);
  assert.deepEqual(Object.keys(m.srs).sort(), ['u2-lz2-01|de-fr', 'u2-lz3-22|fr-de', 'u3-lz1-01|de-fr']);
  assert.equal(m.srs['u2-lz2-01|de-fr'].box, 3);
  assert.deepEqual(m.prep.scopes, ['u2/lz2', 'u3/lz1']);
  assert.deepEqual(m.prep.streak, { 'u2-lz2-05|fr-de': 2 });
  assert.equal(m.settings.scope, 'u2/lz3');
  assert.equal(m.points, 2500);
  // schon in Version 3: nichts wird noch einmal umbenannt
  const again = migrate(m);
  assert.deepEqual(again.srs, m.srs);
  assert.deepEqual(again.prep.scopes, m.prep.scopes);
});

test('Version 1 → 3: Punkte und IDs werden beide übernommen', () => {
  const m = migrate({ version: 1, points: 1000, srs: { 'lz2-02|de-fr': { box: 2, seen: 1 } }, settings: { scope: 'all' } });
  assert.equal(m.points, 2500);
  assert.ok(m.srs['u2-lz2-02|de-fr']);
  assert.equal(m.settings.scope, 'all');
});

test('Version 1 aus dem Speicher wird beim Start übernommen und neu gespeichert', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, srs: {}, days: [], points: 1000, settings: {} }));
  const store = createStore({ storage, persistent: true });
  assert.equal(store.get().points, 2500);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).version, VERSION);
  // ein zweiter Start hebt nicht noch einmal an
  assert.equal(createStore({ storage, persistent: true }).get().points, 2500);
});

test('Import einer Sicherung aus Version 1 übernimmt das Level', () => {
  const { store } = mk();
  assert.deepEqual(store.importJSON(JSON.stringify({ version: 1, srs: {}, points: 1000 })), { ok: true });
  assert.equal(store.get().points, 2500);
});

test('neue Felder: Tagespunkte und Testvorbereitung haben Standardwerte und bleiben erhalten', () => {
  const m = migrate({ version: 2, srs: {}, prep: { scopes: ['a/b'], date: '2026-11-20', streak: { 'w1|de-fr': 2 } }, daily: { day: '2026-11-14', points: 40 } });
  assert.deepEqual(m.prep.scopes, ['a/b']);
  assert.equal(m.prep.date, '2026-11-20');
  assert.equal(m.prep.streak['w1|de-fr'], 2);
  assert.equal(m.prep.lastProbe, null);
  assert.deepEqual(m.daily, { day: '2026-11-14', points: 40 });
  const e = migrate({ version: 2, srs: {}, prep: 'kaputt', daily: 5 });
  assert.deepEqual(e.prep, { scopes: [], date: null, streak: {}, lastProbe: null });
  assert.deepEqual(e.daily, { day: '', points: 0 });
});

test('Export und Import ergeben dieselben Daten', () => {
  const a = mk().store;
  a.update((d) => ({ ...d, points: 7, srs: { 'w1|de-fr': { box: 3 } } }));
  const text = a.exportJSON();
  const b = mk().store;
  assert.deepEqual(b.importJSON(text), { ok: true });
  assert.deepEqual(b.get(), a.get());
});

test('Import: ungültige Dateien werden abgelehnt, Daten bleiben unverändert', () => {
  const { store } = mk();
  store.update((d) => ({ ...d, points: 9 }));
  assert.equal(store.importJSON('hallo').ok, false);
  assert.equal(store.importJSON('{"foo":1}').ok, false);
  assert.equal(store.importJSON(JSON.stringify({ version: 99, srs: {} })).ok, false);
  assert.equal(store.get().points, 9);
});

test('reset leert den Fortschritt', () => {
  const { store } = mk();
  store.update((d) => ({ ...d, points: 9 }));
  store.reset();
  assert.deepEqual(store.get(), emptyData());
});

test('Alter Stand ohne Rundengrösse: Standard bleibt 10, eine gewählte Wahl bleibt erhalten', () => {
  assert.equal(migrate({ version: 3, settings: { sound: false } }).settings.roundSize, 10);
  assert.equal(migrate({ version: 3, settings: { roundSize: 'all' } }).settings.roundSize, 'all');
});
