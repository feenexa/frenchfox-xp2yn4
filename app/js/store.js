// Speicher für Fortschritt und Einstellungen. Nutzt localStorage, fällt bei Fehlern
// (privater Modus, gesperrt, voll) auf Speicher im Arbeitsspeicher zurück.
// Versioniert, mit Export und Import als Sicherung.

import { levelThreshold, legacyLevelFor } from './score.js';

// Version 2 (2026-11-14): strengere Punkteregeln, Tagespunkte, Testvorbereitung.
// Version 3 (2026-11-14): Wort-IDs enthalten die Unité («u2-lz2-01»), Bereiche heissen «u2/lz2».
export const VERSION = 3;
// Der Speicherschlüssel behält den alten Namen «voci.data» (die App hiess früher VociApp),
// damit der gespeicherte Fortschritt beim Umbenennen nicht verloren geht. Nicht ändern.
export const STORAGE_KEY = 'voci.data';

export function emptyData() {
  return {
    version: VERSION,
    srs: {},
    days: [], // Tage mit Übung, 'YYYY-MM-DD'
    points: 0,
    daily: { day: '', points: 0 }, // heute erzielte Punkte (Tageslimit)
    prep: { scopes: [], date: null, streak: {}, lastProbe: null }, // Testvorbereitung
    settings: { direction: 'de-fr', answerMode: 'choice', sound: true, scope: 'all', roundSize: 10 },
  };
}

export function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  };
}

export function safeStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) throw new Error('kein localStorage');
    s.setItem('voci.test', '1');
    s.removeItem('voci.test');
    return { storage: s, persistent: true };
  } catch {
    return { storage: memoryStorage(), persistent: false };
  }
}

// Bis Version 2 gab es nur die Wortliste «lz02-03» (Unité 2) mit IDs wie «lz2-01».
const LEGACY_KEY = /^(lz[23]-\d{2})(?=\|)/;
const mapKeys = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.replace(LEGACY_KEY, 'u2-$1'), v]));
const mapScope = (id) => (typeof id === 'string' ? id.replace(/^lz02-03\//, 'u2/') : id);

/** Bringt gespeicherte Daten auf die aktuelle Version und füllt fehlende Felder. */
export function migrate(raw) {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const rawPrep = raw.prep && typeof raw.prep === 'object' ? raw.prep : {};
  const out = {
    ...base,
    ...raw,
    version: VERSION,
    srs: raw.srs && typeof raw.srs === 'object' ? raw.srs : {},
    days: Array.isArray(raw.days) ? raw.days : [],
    points: Number.isFinite(raw.points) ? raw.points : 0,
    daily: raw.daily && typeof raw.daily === 'object' && Number.isFinite(raw.daily.points)
      ? { day: String(raw.daily.day ?? ''), points: raw.daily.points }
      : base.daily,
    prep: {
      ...base.prep,
      ...rawPrep,
      scopes: Array.isArray(rawPrep.scopes) ? rawPrep.scopes : [],
      streak: rawPrep.streak && typeof rawPrep.streak === 'object' ? rawPrep.streak : {},
    },
    settings: { ...base.settings, ...(raw.settings ?? {}) },
  };
  // Von Version 1 übernehmen: Das bisher erreichte Level bleibt erhalten (neue, höhere Schwellen).
  if ((Number(raw.version) || 1) < 2) {
    out.points = Math.max(out.points, levelThreshold(legacyLevelFor(out.points)));
  }
  // Von Version 1 und 2: Wort-IDs und Bereiche der Unité 2 auf die neuen Namen umstellen.
  if ((Number(raw.version) || 1) < 3) {
    out.srs = mapKeys(out.srs);
    out.prep = { ...out.prep, streak: mapKeys(out.prep.streak), scopes: out.prep.scopes.map(mapScope) };
    out.settings = { ...out.settings, scope: mapScope(out.settings.scope) };
  }
  return out;
}

export function createStore(opts = safeStorage()) {
  const { storage, persistent } = opts;
  let data;
  let stored = null;
  try {
    stored = JSON.parse(storage.getItem(STORAGE_KEY));
    data = migrate(stored);
  } catch {
    data = emptyData();
  }
  // Alte Daten gleich in der neuen Form speichern, damit die Übernahme nur einmal passiert.
  if (stored && typeof stored === 'object' && (Number(stored.version) || 1) < VERSION) save();

  function save() {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  return {
    persistent,
    get: () => data,
    /** fn bekommt die Daten und gibt neue Daten zurück. */
    update(fn) {
      data = migrate(fn(data));
      return save();
    },
    reset() {
      data = emptyData();
      return save();
    },
    exportJSON: () => JSON.stringify(data, null, 2),
    /** Gibt { ok: true } oder { ok: false, error } zurück und ändert bei Fehlern nichts. */
    importJSON(text) {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        return { ok: false, error: 'Die Datei ist keine gültige Sicherung.' };
      }
      if (!parsed || typeof parsed !== 'object' || typeof parsed.version !== 'number' || typeof parsed.srs !== 'object') {
        return { ok: false, error: 'Die Datei sieht nicht nach einer FrenchFox-Sicherung aus.' };
      }
      if (parsed.version > VERSION) {
        return { ok: false, error: 'Die Sicherung stammt von einer neueren App-Version.' };
      }
      data = migrate(parsed);
      save();
      return { ok: true };
    },
  };
}
