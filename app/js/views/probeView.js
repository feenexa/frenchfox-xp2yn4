// Ergebnis des Probe-Tests: Note nach Schweizer Skala und Liste der Fehler mit Lösung.

import { h } from '../ui.js';
import { formatGrade } from '../prep.js';
import { speakFr, speakText, stopSpeaking, canSpeak } from '../speech.js';

function comment(grade) {
  if (grade >= 5.5) return 'Sehr stark! So kannst du in den Test gehen.';
  if (grade >= 4.5) return 'Gut gemacht! Mit ein bisschen Üben wird es noch besser.';
  if (grade >= 3.5) return 'Das wird noch! Übe die Fehler und versuche es nochmal.';
  return 'Du hast jetzt gesehen, was noch fehlt. Mit Üben holst du das auf.';
}

/** params: { total, points, grade, rows: [{ item, dir, score }] } */
export function renderProbe(root, ctx, { total, points, grade, rows }) {
  const { show } = ctx;
  const wrong = rows.filter((r) => r.score < 1);
  const shown = (r) => (r.dir === 'de-fr'
    ? { q: r.item.de.join(' / '), a: r.item.fr }
    : { q: r.item.fr, a: r.item.de.join(' / ') });

  const list = wrong.length
    ? h('div', { class: 'practice-list' },
      h('h2', {}, 'Das war noch nicht richtig:'),
      wrong.map((r) => {
        const s = shown(r);
        return h('div', { class: 'practice-item' },
          h('div', { class: 'words' },
            h('span', { lang: r.dir === 'de-fr' ? 'de' : 'fr' }, s.q),
            h('span', { class: 'solution-line', lang: r.dir === 'de-fr' ? 'fr' : 'de' }, `→ ${s.a}${r.score > 0 ? ' (Zeichen prüfen)' : ''}`)),
          canSpeak && h('button', {
            class: 'icon-btn', 'aria-label': `${r.item.fr} anhören`,
            onClick: () => speakFr(speakText(r.item)),
          }, '🔊'));
      }))
    : null;

  root.replaceChildren(
    h('div', { class: 'result' },
      h('div', { class: 'fox', 'aria-hidden': 'true' }, '🦊'),
      h('h1', {}, 'Probe-Test geschafft'),
      h('div', { class: 'reward' },
        h('div', { class: 'grade-label' }, 'Deine Note'),
        h('div', { class: 'grade' }, formatGrade(grade)),
        h('div', { class: 'reward-line' }, `${points} von ${total} Punkten`),
        h('p', { class: 'hint' }, 'Das ist eine Schätzung nach der Schweizer Skala (6 = alles richtig).')),
      h('p', { class: 'score' }, comment(grade)),
      h('div', { class: 'actions' },
        wrong.length > 0 && h('button', {
          class: 'btn btn-primary',
          onClick: () => show('quiz', {
            items: wrong.map((r) => r.item),
            dirs: Object.fromEntries(wrong.map((r) => [r.item.id, r.dir])),
            mode: 'type',
          }),
        }, 'Fehler üben'),
        h('button', { class: wrong.length ? 'btn' : 'btn btn-primary', onClick: () => show('prep') }, 'Zurück zur Testvorbereitung')),
      list,
    ),
  );

  return () => stopSpeaking();
}
