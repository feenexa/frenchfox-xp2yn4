// Test vorbereiten: Wörter einer oder mehrerer Units wählen, Bereitschaft sehen,
// gezielt üben («bis es sitzt») oder einen Probe-Test machen.

import { h, progressBar } from '../ui.js';
import { readiness, formatGrade, countdownText } from '../prep.js';
import { formatDay } from '../score.js';

export function renderPrep(root, ctx) {
  const { store, scopes, itemsFor, show } = ctx;
  const lernziele = scopes.filter((s) => s.kind === 'lz');

  // Bereiche nach Unit gruppieren (Reihenfolge der Wortlisten)
  const units = [];
  for (const s of lernziele) {
    let u = units.find((x) => x.id === s.unitId);
    if (!u) { u = { id: s.unitId, title: s.unitTitle, scopes: [] }; units.push(u); }
    u.scopes.push(s);
  }

  let selected = new Set(store.get().prep.scopes.filter((id) => lernziele.some((s) => s.id === id)));
  let note = null;

  const savePrep = (patch) => store.update((d) => ({ ...d, prep: { ...d.prep, ...patch } }));
  const saveSelection = () => savePrep({ scopes: [...selected] });
  const setMode = (answerMode) => store.update((d) => ({ ...d, settings: { ...d.settings, answerMode } }));

  function toggle(id, on) {
    if (on) selected.add(id); else selected.delete(id);
    note = null;
    saveSelection();
    render();
  }

  function toggleUnit(u) {
    const allOn = u.scopes.every((s) => selected.has(s.id));
    for (const s of u.scopes) {
      if (allOn) selected.delete(s.id); else selected.add(s.id);
    }
    note = null;
    saveSelection();
    render();
  }

  function render() {
    const data = store.get();
    const items = itemsFor([...selected]);
    const ready = readiness(items, data.srs, data.prep.streak);
    const pct = Math.round(ready.share * 100);
    const date = data.prep.date;
    const last = data.prep.lastProbe;
    const mode = ['type', 'cards'].includes(data.settings.answerMode) ? data.settings.answerMode : 'choice';
    const empty = items.length === 0;

    const unitBlocks = units.map((u) => {
      const allOn = u.scopes.every((s) => selected.has(s.id));
      return h('div', { class: 'unit-block' },
        h('div', { class: 'unit-head' },
          h('span', {}, u.title),
          h('button', { class: 'btn btn-small', onClick: () => toggleUnit(u) }, allOn ? 'Keine' : 'Alle')),
        h('div', { class: 'scope-list' },
          u.scopes.map((s) => {
            const on = selected.has(s.id);
            return h('label', { class: on ? 'check-row is-on' : 'check-row' },
              h('input', { type: 'checkbox', checked: on, onChange: (e) => toggle(s.id, e.target.checked) }),
              h('span', { class: 'check-title' }, s.title),
              h('span', { class: 'scope-sub' }, `${s.items.length} Wörter`));
          })));
    });

    const seg = (label, active, onClick) => h('button', { class: 'seg', 'aria-pressed': active, onClick }, label);

    root.replaceChildren(
      h('div', { class: 'prep' },
        h('header', { class: 'topbar' },
          h('button', { class: 'btn', onClick: () => show('home') }, '← Zurück'),
          h('h1', { class: 'page-title' }, 'Test vorbereiten'),
          h('span', { class: 'topbar-spacer' })),
        h('div', { class: 'home-grid' },
          h('section', { class: 'panel' },
            h('h2', {}, 'Welche Wörter kommen dran?'),
            unitBlocks),
          h('section', { class: 'panel settings' },
            h('h2', {}, 'Deine Testliste'),
            empty
              ? h('p', { class: 'hint' }, 'Wähle links mindestens ein Lernziel aus.')
              : h('div', { class: 'ready' },
                h('div', { class: 'stat-line' }, h('strong', {}, `${items.length} Wörter`), h('span', {}, `Bereit: ${pct} %`)),
                progressBar(ready.share, 'Bereitschaft für den Test'),
                h('div', { class: 'scope-sub' }, `${ready.sure} von ${ready.total} sitzen sicher (jedes Wort in beiden Richtungen)`)),
            h('div', {},
              h('label', { class: 'field-label', for: 'test-date' }, 'Test am'),
              h('div', { class: 'date-row' },
                h('input', {
                  id: 'test-date',
                  class: 'date-input',
                  type: 'date',
                  value: date ?? '',
                  onChange: (e) => { savePrep({ date: e.target.value || null }); render(); },
                }),
                date && h('button', { class: 'btn btn-small', onClick: () => { savePrep({ date: null }); render(); } }, 'Entfernen')),
              date && h('p', { class: 'hint' }, `${formatDay(date)}: ${countdownText(date)}`)),
            h('div', {},
              h('div', { class: 'field-label' }, 'Übungsart beim Üben'),
              h('div', { class: 'segmented three' },
                seg('Auswählen', mode === 'choice', () => { setMode('choice'); render(); }),
                seg('Tippen', mode === 'type', () => { setMode('type'); render(); }),
                seg('Karteikarten', mode === 'cards', () => { setMode('cards'); render(); }))),
            h('div', { class: 'prep-actions' },
              h('button', {
                class: 'btn btn-primary btn-big',
                disabled: empty,
                onClick: () => {
                  if (!ctx.startPractice()) {
                    note = { ok: true, text: '🎉 Alles sitzt schon! Mach einen Probe-Test, um es zu prüfen.' };
                    render();
                  }
                },
              }, 'Üben bis es sitzt'),
              h('button', { class: 'btn btn-big', disabled: empty, onClick: () => ctx.startProbe() }, 'Probe-Test'),
              h('p', { class: 'hint' }, 'Probe-Test: alle Wörter einmal getippt, ohne Hinweise, am Ende gibt es eine Note.')),
            last && h('p', { class: 'hint' }, `Letzter Probe-Test: Note ${formatGrade(last.grade)} (${formatDay(last.day)}, ${last.points} von ${last.max} Punkten)`),
            note && h('p', { class: note.ok ? 'feedback is-ok' : 'feedback is-bad', role: 'status' }, note.text)))),
    );
  }

  render();
}
