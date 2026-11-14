import { test } from 'node:test';
import assert from 'node:assert/strict';
import { review, pickSession, boxCounts, learnedShare, keyOf, DAY, isDue } from '../app/js/srs.js';

const items = Array.from({ length: 12 }, (_, i) => ({ id: `w${i + 1}` }));
const dir = 'de-fr';
const NOW = new Date(2026, 10, 13, 15, 30).getTime(); // 13.11.2026, 15:30 lokal
const midnight = new Date(2026, 10, 13).getTime();

function seeded(seed = 1) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

test('review: richtig steigt eine Box, fällig an einem Kalendertag', () => {
  const k = keyOf('w1', dir);
  let st = review({}, k, 'correct', NOW);
  assert.equal(st[k].box, 2);
  assert.equal(st[k].due, midnight + 1 * DAY);
  st = review(st, k, 'correct', NOW);
  assert.equal(st[k].box, 3);
  assert.equal(st[k].due, midnight + 3 * DAY);
  assert.equal(st[k].right, 2);
});

test('review: Box 5 ist das Maximum', () => {
  const k = keyOf('w1', dir);
  let st = {};
  for (let i = 0; i < 8; i++) st = review(st, k, 'correct', NOW);
  assert.equal(st[k].box, 5);
});

test('review: falsch zurück in Box 1 und sofort wieder fällig', () => {
  const k = keyOf('w1', dir);
  let st = {};
  for (let i = 0; i < 3; i++) st = review(st, k, 'correct', NOW);
  st = review(st, k, 'wrong', NOW);
  assert.equal(st[k].box, 1);
  assert.equal(st[k].wrong, 1);
  assert.ok(isDue(st[k], NOW));
});

test('review: nur Akzent falsch behält die Box, morgen wieder', () => {
  const k = keyOf('w1', dir);
  let st = review({}, k, 'correct', NOW); // Box 2
  st = review(st, k, 'accent', NOW);
  assert.equal(st[k].box, 2);
  assert.equal(st[k].due, midnight + DAY);
});

test('review: verändert den alten Zustand nicht', () => {
  const k = keyOf('w1', dir);
  const old = {};
  review(old, k, 'correct', NOW);
  assert.deepEqual(old, {});
});

test('Richtungen werden getrennt gelernt', () => {
  let st = review({}, keyOf('w1', 'de-fr'), 'correct', NOW);
  assert.equal(st[keyOf('w1', 'fr-de')], undefined);
});

test('pickSession: leerer Zustand liefert neue Wörter, höchstens size', () => {
  const s = pickSession(items, dir, {}, NOW, { size: 10, rng: seeded(1) });
  assert.equal(s.length, 10);
  assert.equal(new Set(s.map((i) => i.id)).size, 10);
});

test('pickSession: fällige Wörter kommen vor neuen, maxNew wird eingehalten', () => {
  let st = {};
  // 8 Wörter gesehen und fällig machen
  for (const it of items.slice(0, 8)) st = review(st, keyOf(it.id, dir), 'wrong', NOW - 1000);
  const s = pickSession(items, dir, st, NOW, { size: 10, maxNew: 2, rng: seeded(2) });
  const ids = new Set(s.map((i) => i.id));
  for (const it of items.slice(0, 8)) assert.ok(ids.has(it.id), `${it.id} fehlt`);
  assert.equal(s.filter((i) => !st[keyOf(i.id, dir)]).length, 2);
});

test('pickSession: nicht fällige Wörter werden nur zum Auffüllen genommen', () => {
  let st = {};
  for (const it of items) st = review(st, keyOf(it.id, dir), 'correct', NOW); // alle fällig erst morgen
  const s = pickSession(items, dir, st, NOW, { size: 5, rng: seeded(3) });
  assert.equal(s.length, 5); // aufgefüllt, damit eine Runde möglich bleibt
  const later = pickSession(items, dir, st, NOW + 2 * DAY, { size: 5, rng: seeded(3) });
  assert.equal(later.length, 5);
});

test('pickSession: weniger Wörter als size', () => {
  const s = pickSession(items.slice(0, 3), dir, {}, NOW, { size: 10 });
  assert.equal(s.length, 3);
  assert.equal(pickSession([], dir, {}, NOW).length, 0);
});

test('boxCounts und learnedShare', () => {
  let st = {};
  const k1 = keyOf('w1', dir);
  for (let i = 0; i < 4; i++) st = review(st, k1, 'correct', NOW); // Box 5
  st = review(st, keyOf('w2', dir), 'correct', NOW); // Box 2
  const c = boxCounts(items, dir, st);
  assert.equal(c[0], 10);
  assert.equal(c[2], 1);
  assert.equal(c[5], 1);
  assert.equal(learnedShare(items, dir, st), 1 / 12);
  assert.equal(learnedShare([], dir, st), 0);
});

test('Rundengrösse: Zahl, «alle», zu gross, unbekannte Werte', async () => {
  const { roundSize } = await import('../app/js/srs.js');
  assert.equal(roundSize(10, 89), 10);
  assert.equal(roundSize('all', 89), 89);
  assert.equal(roundSize(20, 18), 18);
  for (const bad of [undefined, null, 'x', 0, -3, 2.5]) assert.equal(roundSize(bad, 30), 30, String(bad));
  const items = Array.from({ length: 25 }, (_, i) => ({ id: `t-${i}` }));
  const all = pickSession(items, 'de-fr', {}, Date.now(), { size: roundSize('all', items.length) });
  assert.equal(all.length, 25);
  assert.equal(new Set(all.map((i) => i.id)).size, 25);
});

test('Schieberegler-Stufen: Fünferschritte, am Ende die ganze Liste', async () => {
  const { roundSteps } = await import('../app/js/srs.js');
  assert.deepEqual(roundSteps(18), [5, 10, 15, 18]);
  assert.deepEqual(roundSteps(20), [5, 10, 15, 20]);
  assert.equal(roundSteps(130).at(-1), 130);
  assert.deepEqual(roundSteps(5), []);
  assert.deepEqual(roundSteps(0), []);
});
