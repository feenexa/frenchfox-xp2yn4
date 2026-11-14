// Ergebnis einer Runde: Punkte, Serie, Level und die Wörter zum Nachüben.

import { h, progressBar, mascot } from '../ui.js';
import { speakFr, speakText, stopSpeaking, canSpeak } from '../speech.js';
import { readiness } from '../prep.js';

function headline(right, total) {
  const share = total ? right / total : 0;
  if (share === 1) return 'Perfekt!';
  if (share >= 0.7) return 'Super gemacht!';
  if (share >= 0.4) return 'Gut dran geblieben!';
  return 'Weiter so, es wird besser!';
}

function streakText(streak) {
  if (streak >= 2) return `🔥 ${streak} Tage in Folge`;
  if (streak === 1) return '🔥 Serie gestartet! Komm morgen wieder.';
  return null;
}

/**
 * params: { total, right, wrong: Wörter, direction, dirs, mode, test,
 *           gained, perfectBonus, streak, levelBefore, levelAfter, dailyDone, lowShare }
 */
export function renderResult(root, ctx, {
  total, right, wrong, direction, dirs, mode, test,
  gained = 0, perfectBonus = 0, streak = 0, levelBefore, levelAfter, dailyDone = false, lowShare = false,
}) {
  const { show, store, itemsFor } = ctx;
  const leveledUp = levelBefore && levelAfter && levelAfter.level > levelBefore.level;
  const streakLine = streakText(streak);
  const practice = test === 'practice';

  const list = wrong.length
    ? h('div', { class: 'practice-list' },
      h('h2', {}, 'Nochmal üben:'),
      wrong.map((it) =>
        h('div', { class: 'practice-item' },
          h('div', { class: 'words' },
            h('span', { lang: 'fr' }, it.fr),
            h('span', { lang: 'de' }, it.de.join(' / '))),
          canSpeak && h('button', {
            class: 'icon-btn', 'aria-label': `${it.fr} anhören`,
            onClick: () => speakFr(speakText(it)),
          }, '🔊'))))
    : null;

  const levelBox = levelAfter && (leveledUp
    ? h('div', { class: 'level-banner' },
      h('div', { class: 'level-title' }, `🎉 Neues Level! Level ${levelAfter.level}`),
      h('div', {}, levelAfter.title))
    : h('div', { class: 'level-progress' },
      h('div', { class: 'stat-line' }, h('strong', {}, `Level ${levelAfter.level}`), h('span', {}, levelAfter.title)),
      progressBar(levelAfter.fraction, 'Fortschritt zum nächsten Level'),
      h('div', { class: 'scope-sub' }, `Noch ${levelAfter.toNext} Punkte bis Level ${levelAfter.level + 1}`)));

  // Testvorbereitung: wie weit ist die Testliste?
  let prepBox = null;
  let allSure = false;
  if (practice) {
    const d = store.get();
    const ready = readiness(itemsFor(d.prep.scopes), d.srs, d.prep.streak);
    allSure = ready.total > 0 && ready.sure === ready.total;
    prepBox = allSure
      ? h('div', { class: 'level-banner' },
        h('div', { class: 'level-title' }, '🎉 Alles sitzt!'),
        h('div', {}, 'Mach jetzt einen Probe-Test, um es zu prüfen.'))
      : h('div', { class: 'level-progress' },
        h('div', { class: 'stat-line' }, h('strong', {}, 'Testliste'), h('span', {}, `Bereit: ${Math.round(ready.share * 100)} %`)),
        progressBar(ready.share, 'Bereitschaft für den Test'),
        h('div', { class: 'scope-sub' }, `${ready.sure} von ${ready.total} sitzen sicher`));
  }

  const notes = [];
  if (dailyDone) notes.push('Tagesziel geschafft! Weiterüben bringt jetzt nur noch halbe Punkte.');
  else if (lowShare) notes.push('Viele Wörter waren heute noch nicht dran, dafür gibt es weniger Punkte. Komm morgen wieder, dann zählt es voll.');

  const primary = [];
  if (practice) {
    if (!allSure) primary.push(h('button', { class: 'btn btn-primary', onClick: () => ctx.startPractice() }, 'Weiter üben'));
    primary.push(h('button', { class: allSure ? 'btn btn-primary' : 'btn', onClick: () => show('prep') }, 'Zur Testvorbereitung'));
  } else {
    if (wrong.length > 0) {
      primary.push(h('button', {
        class: 'btn btn-primary',
        onClick: () => show('quiz', { items: wrong, direction, dirs, mode }),
      }, 'Diese Wörter nochmal'));
    }
    primary.push(h('button', { class: wrong.length ? 'btn' : 'btn btn-primary', onClick: () => show('home') }, 'Zur Startseite'));
  }

  root.replaceChildren(
    h('div', { class: 'result' },
      h('div', { class: 'fox', 'aria-hidden': 'true' }, mascot()),
      h('h1', {}, headline(right, total)),
      h('p', { class: 'score' }, mode === 'cards'
        ? `${right} von ${total} gleich gewusst`
        : `${right} von ${total} gleich beim ersten Mal richtig`),
      h('div', { class: 'reward' },
        h('div', { class: 'reward-points' }, `⭐ +${gained} Punkte`),
        perfectBonus > 0 && h('div', { class: 'reward-line' }, `Perfekte Runde: +${perfectBonus} Bonus`),
        streakLine && h('div', { class: 'reward-line' }, streakLine),
        notes.map((n) => h('p', { class: 'hint' }, n))),
      prepBox,
      levelBox,
      h('div', { class: 'actions' }, primary),
      list,
    ),
  );

  return () => stopSpeaking();
}
