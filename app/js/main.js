// Einstieg: lädt die Wortlisten, öffnet den Speicher und schaltet zwischen den Ansichten um.

import { createStore } from './store.js';
import { h } from './ui.js';
import { pickPractice, buildProbe } from './prep.js';
import { renderHome } from './views/homeView.js';
import { renderQuiz } from './views/quizView.js';
import { renderResult } from './views/resultView.js';
import { renderPrep } from './views/prepView.js';
import { renderProbe } from './views/probeView.js';
import { renderHelp } from './views/helpView.js';

const root = document.getElementById('app');
const views = {
  home: renderHome,
  quiz: renderQuiz,
  result: renderResult,
  prep: renderPrep,
  probe: renderProbe,
  help: renderHelp,
};
let cleanup = null;

async function loadUnits() {
  // «no-cache»: der Browser fragt jedes Mal nach, ob sich die Wortlisten geändert haben.
  const opts = { cache: 'no-cache' };
  const names = await (await fetch('data/units/index.json', opts)).json();
  return Promise.all(names.map(async (n) => (await fetch(`data/units/${n}`, opts)).json()));
}

/**
 * Wortlisten → Auswahlbereiche. kind: 'all' (alles gemischt), 'unit' (ganze Unité, nur bei mehreren Units),
 * 'lz' (ein Lernziel). Gruppiert wird nach Unité und darin nach Lernziel.
 */
function buildScopes(units) {
  const all = units.flatMap((u) => u.lernziele.flatMap((lz) => lz.items));
  const scopes = [{ id: 'all', kind: 'all', title: 'Alles gemischt', items: all }];
  for (const u of units) {
    if (units.length > 1) {
      scopes.push({
        id: u.id,
        kind: 'unit',
        title: `Ganze ${u.title}`,
        unitId: u.id,
        unitTitle: u.title,
        items: u.lernziele.flatMap((lz) => lz.items),
      });
    }
    for (const lz of u.lernziele) {
      scopes.push({ id: `${u.id}/${lz.id}`, kind: 'lz', title: lz.title, unitId: u.id, unitTitle: u.title, items: lz.items });
    }
  }
  return { all, scopes };
}

function fail(message) {
  root.replaceChildren(
    h('div', { class: 'notice' },
      h('div', { class: 'fox', style: 'font-size:80px' }, '🦊'),
      h('h1', {}, 'Oh, das hat nicht geklappt'),
      h('p', {}, message),
      h('button', { class: 'btn btn-primary', onClick: () => location.reload() }, 'Nochmal versuchen'),
    ),
  );
}

async function start() {
  let units;
  try {
    units = await loadUnits();
  } catch {
    fail('Die Wortlisten konnten nicht geladen werden. Öffne die App über die Adresse des Servers, nicht als Datei.');
    return;
  }

  const store = createStore();
  const { all, scopes } = buildScopes(units);

  const ctx = {
    store,
    units,
    allItems: all,
    scopes,
    show(name, params) {
      if (cleanup) cleanup();
      cleanup = null;
      window.scrollTo(0, 0);
      root.replaceChildren();
      cleanup = views[name](root, ctx, params) ?? null;
    },

    /** Wörter der gewählten Bereiche (ohne «Alles gemischt», ohne Doppelte). */
    itemsFor(scopeIds) {
      const seen = new Set();
      const out = [];
      for (const id of scopeIds) {
        const s = scopes.find((x) => x.id === id && x.kind !== 'all');
        if (!s) continue;
        for (const it of s.items) {
          if (!seen.has(it.id)) { seen.add(it.id); out.push(it); }
        }
      }
      return out;
    },

    /** Testvorbereitung: nächste Übungsrunde mit den schwächsten Wörtern. false = es sitzt schon alles. */
    startPractice() {
      const d = store.get();
      const items = ctx.itemsFor(d.prep.scopes);
      const picks = pickPractice(items, d.srs, d.prep.streak, { size: 10 });
      if (!picks.length) return false;
      ctx.show('quiz', {
        items: picks.map((p) => p.item),
        dirs: Object.fromEntries(picks.map((p) => [p.item.id, p.dir])),
        mode: d.settings.answerMode,
        test: 'practice',
      });
      return true;
    },

    /** Probe-Test: alle Wörter der Testliste einmal, getippt. false = Testliste leer. */
    startProbe() {
      const items = ctx.itemsFor(store.get().prep.scopes);
      if (!items.length) return false;
      const picks = buildProbe(items);
      ctx.show('quiz', {
        items: picks.map((p) => p.item),
        dirs: Object.fromEntries(picks.map((p) => [p.item.id, p.dir])),
        mode: 'type',
        test: 'probe',
      });
      return true;
    },
  };
  ctx.show('home');
}

// Offline-Betrieb: nur über HTTPS oder localhost möglich. Auf localhost nur mit ?sw=1,
// damit beim Entwickeln nicht ein alter Stand aus dem Zwischenspeicher erscheint.
if ('serviceWorker' in navigator && window.isSecureContext
  && (location.hostname !== 'localhost' || location.search.includes('sw=1'))) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

start();
