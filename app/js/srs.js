// Wiederholungsplan nach Leitner: fünf Boxen, richtige Wörter wandern nach oben,
// Fehler bringen das Wort in Box 1 zurück. Kein DOM-Zugriff.
//
// Zustand: { [key]: { box, due, seen, right, wrong, last } }
// key = `${itemId}|${dir}`, Hin- und Rückrichtung werden getrennt gelernt.

import { shuffle } from './quiz.js';

export const DAY = 86400000;
export const MAX_BOX = 5;
/** Abstand bis zur nächsten Wiederholung je Box in Tagen. */
export const INTERVAL_DAYS = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 21 };
/** Ab dieser Box gilt ein Wort als gelernt. */
export const LEARNED_BOX = 4;

export const keyOf = (id, dir) => `${id}|${dir}`;

export function newEntry() {
  return { box: 1, due: 0, seen: 0, right: 0, wrong: 0, last: 0 };
}

function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Verbucht eine Antwort. Gibt einen neuen Zustand zurück (ändert den alten nicht).
 * result: 'correct' | 'accent' | 'wrong'
 *  - correct: eine Box höher
 *  - accent: Box bleibt, morgen wieder
 *  - wrong: zurück in Box 1, kommt in dieser Runde wieder
 */
export function review(state, key, result, now = Date.now()) {
  const e = { ...(state[key] ?? newEntry()) };
  e.seen += 1;
  e.last = now;
  if (result === 'correct') {
    e.right += 1;
    e.box = Math.min(MAX_BOX, e.box + 1);
    e.due = startOfDay(now) + INTERVAL_DAYS[e.box] * DAY;
  } else if (result === 'accent') {
    e.right += 1;
    e.due = startOfDay(now) + DAY;
  } else {
    e.wrong += 1;
    e.box = 1;
    e.due = now;
  }
  return { ...state, [key]: e };
}

export function isDue(entry, now = Date.now()) {
  return !!entry && entry.seen > 0 && entry.due <= now;
}

/** Neues oder fälliges Wort: Üben bringt jetzt wirklich etwas (volle Punkte). */
export function needsPractice(entry, now = Date.now()) {
  return !entry || !(entry.seen > 0) || entry.due <= now;
}

/**
 * Wählt die Wörter für eine Runde: fällige zuerst, dazu einige neue,
 * Rest mit den am frühesten fälligen. Reihenfolge gemischt.
 */
export function pickSession(items, dir, state, now = Date.now(), { size = 10, maxNew = 5, rng = Math.random } = {}) {
  const entryOf = (it) => state[keyOf(it.id, dir)];
  const due = items
    .filter((it) => isDue(entryOf(it), now))
    .sort((a, b) => entryOf(a).box - entryOf(b).box || entryOf(a).due - entryOf(b).due);
  const fresh = shuffle(items.filter((it) => !entryOf(it) || entryOf(it).seen === 0), rng);
  const rest = items
    .filter((it) => entryOf(it)?.seen > 0 && !isDue(entryOf(it), now))
    .sort((a, b) => entryOf(a).due - entryOf(b).due);

  const picked = due.slice(0, Math.max(0, size - Math.min(maxNew, fresh.length)));
  picked.push(...fresh.slice(0, size - picked.length));
  picked.push(...rest.slice(0, size - picked.length));
  return shuffle(picked.slice(0, size), rng);
}

/** Anzahl Wörter je Box (Index 0 = noch nie gesehen). */
export function boxCounts(items, dir, state) {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const it of items) {
    const e = state[keyOf(it.id, dir)];
    counts[e && e.seen > 0 ? e.box : 0] += 1;
  }
  return counts;
}

/** Anteil gelernter Wörter (0 bis 1). */
export function learnedShare(items, dir, state) {
  if (!items.length) return 0;
  const learned = items.filter((it) => (state[keyOf(it.id, dir)]?.box ?? 0) >= LEARNED_BOX).length;
  return learned / items.length;
}
