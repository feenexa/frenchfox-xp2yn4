// Startseite: Lernziel wählen, Richtung wählen, losgehen.

import { h, progressBar, mascot } from '../ui.js';
import { pickSession, learnedShare, isDue, keyOf } from '../srs.js';
import { canSpeak } from '../speech.js';
import { levelInfo, streakFor, dayKey, formatDay } from '../score.js';
import { readiness, countdownText } from '../prep.js';
import { LEGAL_NOTICE } from '../help.js';

const isStandalone = () => window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const SESSION_SIZE = 10;

export function renderHome(root, ctx) {
  const { store, scopes, show } = ctx;
  const settings = () => store.get().settings;
  let scopeId = scopes.some((s) => s.id === settings().scope) ? settings().scope : 'all';

  const setSetting = (patch) => store.update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  let backupOpen = false;
  let backupMsg = null; // { ok, text }
  const openUnits = new Set(); // aufgeklappte Units (bei mehreren Units)
  const selectedUnit = scopes.find((s) => s.id === scopeId)?.unitId;
  if (selectedUnit) openUnits.add(selectedUnit);

  function exportBackup() {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: `frenchfox-sicherung-${dayKey(Date.now())}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    backupMsg = { ok: true, text: 'Sicherung wurde erstellt. Bewahre die Datei gut auf (z. B. in «Dateien» oder per Mail).' };
    render();
  }

  async function importBackup(file) {
    if (!file) return;
    if (!window.confirm('Den aktuellen Fortschritt auf diesem Gerät durch die Sicherung ersetzen?')) return;
    const res = store.importJSON(await file.text());
    backupMsg = res.ok
      ? { ok: true, text: 'Sicherung wurde geladen.' }
      : { ok: false, text: res.error };
    render();
  }

  function backupSection() {
    const fileInput = h('input', {
      type: 'file',
      accept: 'application/json,.json',
      hidden: true,
      onChange: (e) => { importBackup(e.target.files[0]); e.target.value = ''; },
    });
    const showTip = isIos() && !isStandalone();
    return h('details', {
      class: 'backup',
      open: backupOpen,
      onToggle: (e) => { backupOpen = e.target.open; },
    },
    h('summary', {}, 'Sicherung und Home-Bildschirm (für Eltern)'),
    h('div', { class: 'backup-body' },
      showTip && h('p', {},
        'Tipp: Mit «Teilen» → «Zum Home-Bildschirm» wird die App zu einem eigenen Symbol. Dort bleibt der Fortschritt besser erhalten. Der Fortschritt aus dem Browser wird nicht automatisch übernommen: vorher sichern, danach in der Home-Bildschirm-App laden.'),
      !store.persistent && h('p', { class: 'hint' }, 'Auf diesem Gerät kann nichts gespeichert werden. Der Fortschritt geht beim Schliessen verloren.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onClick: exportBackup }, 'Sicherung erstellen'),
        h('button', { class: 'btn', onClick: () => fileInput.click() }, 'Sicherung laden')),
      fileInput,
      backupMsg && h('p', { class: backupMsg.ok ? 'feedback is-ok' : 'feedback is-bad', role: 'status' }, backupMsg.text)));
  }

  function render() {
    const { direction, sound, answerMode } = settings();
    const mode = answerMode === 'type' || answerMode === 'cards' ? answerMode : 'choice';
    const scope = scopes.find((s) => s.id === scopeId);
    const srs = store.get().srs;

    const dueCount = scope.items.filter((it) => isDue(srs[keyOf(it.id, direction)])).length;
    const seenCount = scope.items.filter((it) => srs[keyOf(it.id, direction)]?.seen > 0).length;
    const dueText = dueCount > 0
      ? `Heute fällig: ${dueCount} ${dueCount === 1 ? 'Wort' : 'Wörter'}`
      : seenCount === 0
        ? 'Alles noch neu. Los geht’s!'
        : 'Heute ist nichts fällig. Du kannst trotzdem üben.';

    const scopeCard = (s) => {
      const share = learnedShare(s.items, direction, srs);
      return h('button', {
        class: 'scope-card',
        'aria-pressed': s.id === scopeId,
        onClick: () => { scopeId = s.id; setSetting({ scope: s.id }); render(); },
      },
      h('div', { class: 'scope-title' }, h('span', {}, s.title), h('span', {}, `${Math.round(share * 100)}%`)),
      h('div', { class: 'scope-sub' }, `${s.items.length} Wörter`),
      progressBar(share, `${s.title}: gelernt`));
    };
    // Bei mehreren Units sind die Lernziele nach Unit gruppiert und aufklappbar.
    const scopeCards = ctx.units.length > 1
      ? [
        scopeCard(scopes[0]),
        ...ctx.units.map((u) => h('details', {
          class: 'unit-group',
          open: openUnits.has(u.id),
          onToggle: (e) => { if (e.target.open) openUnits.add(u.id); else openUnits.delete(u.id); },
        },
        h('summary', {}, u.title),
        h('div', { class: 'scope-list' }, scopes.filter((s) => s.unitId === u.id).map(scopeCard)))),
      ]
      : scopes.map(scopeCard);

    // Abkürzung zur Testvorbereitung
    const prep = store.get().prep;
    const prepItems = ctx.itemsFor(prep.scopes);
    let prepSub = 'Wörter für einen Test gezielt üben';
    if (prepItems.length) {
      const ready = readiness(prepItems, store.get().srs, prep.streak);
      prepSub = `${Math.round(ready.share * 100)} % bereit${prep.date ? ` · Test ${formatDay(prep.date)}, ${countdownText(prep.date)}` : ''}`;
    }
    const prepEntry = h('button', { class: 'prep-entry', onClick: () => show('prep') },
      h('span', { class: 'stat-icon', 'aria-hidden': 'true' }, '📝'),
      h('span', { class: 'prep-entry-text' }, h('strong', {}, 'Test vorbereiten'), h('span', {}, prepSub)));

    const lvl = levelInfo(store.get().points);
    const streak = streakFor(store.get().days);
    const streakText = streak >= 2 ? `${streak} Tage in Folge` : streak === 1 ? '1 Tag' : 'Starte deine Serie!';
    const stats = h('section', { class: 'stats', 'aria-label': 'Dein Stand' },
      h('div', { class: 'stat' }, h('span', { class: 'stat-icon', 'aria-hidden': 'true' }, '🔥'), h('span', {}, streakText)),
      h('div', { class: 'stat' }, h('span', { class: 'stat-icon', 'aria-hidden': 'true' }, '⭐'), h('span', {}, `${lvl.points} Punkte`)),
      h('div', { class: 'stat stat-level' },
        h('div', { class: 'stat-line' }, h('strong', {}, `Level ${lvl.level}`), h('span', {}, lvl.title)),
        progressBar(lvl.fraction, `Level ${lvl.level}: Fortschritt zum nächsten Level`),
        h('div', { class: 'scope-sub' }, `Noch ${lvl.toNext} Punkte bis Level ${lvl.level + 1}`)));

    const seg = (label, active, onClick, extra = {}) =>
      h('button', { class: 'seg', 'aria-pressed': active, onClick, ...extra }, label);

    const page = h('div', { class: 'home' },
      h('header', { class: 'topbar' },
        h('div', { class: 'brand' }, h('span', { class: 'fox', 'aria-hidden': 'true' }, mascot()), h('span', {}, 'FrenchFox')),
        h('div', { class: 'topbar-actions' },
          h('button', { class: 'icon-btn', 'aria-label': 'Anleitung', onClick: () => show('help') }, '?'),
          canSpeak && h('button', {
            class: 'icon-btn',
            'aria-label': sound ? 'Ton ausschalten' : 'Ton einschalten',
            onClick: () => { setSetting({ sound: !sound }); render(); },
          }, sound ? '🔊' : '🔇')),
      ),
      stats,
      prepEntry,
      h('div', { class: 'home-grid' },
        h('section', { class: 'panel' },
          h('h2', {}, 'Was üben wir?'),
          h('div', { class: 'scope-list' }, scopeCards)),
        h('section', { class: 'panel settings' },
          h('div', {},
            h('div', { class: 'field-label' }, 'Richtung'),
            h('div', { class: 'segmented' },
              seg('Deutsch → Französisch', direction === 'de-fr', () => { setSetting({ direction: 'de-fr' }); render(); }),
              seg('Französisch → Deutsch', direction === 'fr-de', () => { setSetting({ direction: 'fr-de' }); render(); }))),
          h('div', {},
            h('div', { class: 'field-label' }, 'Wie üben?'),
            h('div', { class: 'segmented three' },
              seg('Auswählen', mode === 'choice', () => { setSetting({ answerMode: 'choice' }); render(); }),
              seg('Tippen', mode === 'type', () => { setSetting({ answerMode: 'type' }); render(); }),
              seg('Karteikarten', mode === 'cards', () => { setSetting({ answerMode: 'cards' }); render(); }))),
          h('button', {
            class: 'btn btn-primary btn-big',
            onClick: () => {
              const items = pickSession(scope.items, direction, store.get().srs, Date.now(), { size: SESSION_SIZE });
              show('quiz', { items, direction, mode });
            },
          }, 'Los geht’s'),
          h('p', { class: 'hint' }, dueText),
          !store.persistent && h('p', { class: 'hint' }, 'Hinweis: Der Fortschritt kann auf diesem Gerät nicht gespeichert werden.'),
          backupSection(),
        ),
      ),
      h('p', { class: 'legal' }, LEGAL_NOTICE),
    );
    root.replaceChildren(page);
  }

  render();
}
