// Testvorbereitung: Bereitschaft, Auswahl der schwächsten Wörter, Probe-Test und Note.
// Kein DOM-Zugriff.
//
// Ein «Wort-Paar» ist ein Wort in einer Richtung. Jedes Wort muss in beiden Richtungen sitzen.
// Ein Paar sitzt («sicher»), wenn es in der Testübung zweimal hintereinander richtig war
// oder im Wiederholungsplan schon in Box 3 oder höher steht.

import { keyOf } from './srs.js';
import { shuffle } from './quiz.js';
import { daysUntil } from './score.js';

export const DIRS = ['de-fr', 'fr-de'];
export const SURE_STREAK = 2;
export const SURE_BOX = 3;

export function isSure(key, srs, streak) {
  return (streak[key] ?? 0) >= SURE_STREAK || (srs[key]?.seen > 0 && srs[key].box >= SURE_BOX);
}

/** Bereitschaft für eine Testliste: { sure, total, share } über alle Wort-Paare. */
export function readiness(items, srs, streak) {
  let sure = 0;
  for (const it of items) {
    for (const dir of DIRS) if (isSure(keyOf(it.id, dir), srs, streak)) sure += 1;
  }
  const total = items.length * DIRS.length;
  return { sure, total, share: total ? sure / total : 0 };
}

/** Je kleiner, desto schwächer. */
function weakness(key, srs, streak) {
  const box = srs[key]?.seen > 0 ? srs[key].box : 0;
  return box * 2 + (streak[key] ?? 0);
}

/**
 * Wählt die Wörter für eine Übungsrunde: die schwächsten, die noch nicht sitzen.
 * Je Wort die Richtung, die noch nicht sitzt (bei beiden die schwächere).
 * Gibt [{ item, dir }] zurück, höchstens `size`, in gemischter Reihenfolge.
 */
export function pickPractice(items, srs, streak, { size = 10, rng = Math.random } = {}) {
  const cands = [];
  for (const item of items) {
    const open = DIRS
      .filter((d) => !isSure(keyOf(item.id, d), srs, streak))
      .map((dir) => ({ dir, w: weakness(keyOf(item.id, dir), srs, streak) }));
    if (!open.length) continue;
    open.sort((a, b) => a.w - b.w);
    cands.push({ item, dir: open[0].dir, w: open[0].w });
  }
  const weakest = shuffle(cands, rng).sort((a, b) => a.w - b.w).slice(0, size);
  return shuffle(weakest, rng).map(({ item, dir }) => ({ item, dir }));
}

/** Probe-Test: jedes Wort einmal, die Richtung zufällig, Reihenfolge gemischt. */
export function buildProbe(items, rng = Math.random) {
  return shuffle(items, rng).map((item) => ({ item, dir: rng() < 0.5 ? 'de-fr' : 'fr-de' }));
}

/** Verbucht die Antwort in der Testübung: richtig (auch nur Akzent falsch) zählt weiter, falsch setzt zurück. */
export function updateStreak(streak, key, right) {
  return { ...streak, [key]: right ? (streak[key] ?? 0) + 1 : 0 };
}

/** Punkte eines Wortes im Probe-Test. */
export function probePoints(result) {
  return result === 'correct' ? 1 : result === 'accent' ? 0.5 : 0;
}

/** Schweizer Note (6 = alles richtig, 1 = nichts), auf Viertel gerundet. */
export function swissGrade(points, max) {
  if (!max) return 1;
  return Math.round((1 + 5 * (points / max)) * 4) / 4;
}

/** «noch 6 Tage», «morgen!», «heute!» oder ein Hinweis, wenn das Datum vorbei ist. */
export function countdownText(date, now = Date.now()) {
  const days = daysUntil(date, now);
  if (days > 1) return `noch ${days} Tage`;
  if (days === 1) return 'morgen!';
  if (days === 0) return 'heute!';
  return 'schon vorbei';
}

export function formatGrade(n) {
  if (Number.isInteger(n)) return String(n);
  return Number.isInteger(n * 2) ? n.toFixed(1) : n.toFixed(2);
}
