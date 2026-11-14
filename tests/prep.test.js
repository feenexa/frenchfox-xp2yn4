import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSure, readiness, pickPractice, buildProbe, updateStreak, probePoints, swissGrade, formatGrade, countdownText, DIRS } from '../app/js/prep.js';
import { keyOf, needsPractice, review } from '../app/js/srs.js';

const items = Array.from({ length: 12 }, (_, i) => ({ id: `w${i + 1}` }));
const NOW = new Date(2026, 10, 14, 15, 0).getTime();

function seeded(seed = 1) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

test('isSure: zweimal hintereinander richtig oder Box 3+', () => {
  const k = keyOf('w1', 'de-fr');
  assert.equal(isSure(k, {}, {}), false);
  assert.equal(isSure(k, {}, { [k]: 1 }), false);
  assert.equal(isSure(k, {}, { [k]: 2 }), true);
  assert.equal(isSure(k, { [k]: { box: 2, seen: 3 } }, {}), false);
  assert.equal(isSure(k, { [k]: { box: 3, seen: 3 } }, {}), true);
});

test('readiness: Wort-Paare in beiden Richtungen', () => {
  const streak = { [keyOf('w1', 'de-fr')]: 2, [keyOf('w1', 'fr-de')]: 2, [keyOf('w2', 'de-fr')]: 2 };
  const r = readiness(items, {}, streak);
  assert.equal(r.total, 24);
  assert.equal(r.sure, 3);
  assert.equal(r.share, 3 / 24);
  assert.deepEqual(readiness([], {}, {}), { sure: 0, total: 0, share: 0 });
});

test('updateStreak: richtig zählt hoch, falsch setzt zurück, Original bleibt unverändert', () => {
  const s0 = {};
  const k = keyOf('w1', 'de-fr');
  const s1 = updateStreak(s0, k, true);
  const s2 = updateStreak(s1, k, true);
  assert.equal(s2[k], 2);
  assert.equal(updateStreak(s2, k, false)[k], 0);
  assert.deepEqual(s0, {});
});

test('pickPractice: höchstens size, ein Paar je Wort, nur unsichere Richtung', () => {
  const streak = {};
  for (const it of items.slice(0, 6)) streak[keyOf(it.id, 'de-fr')] = 2; // de-fr sitzt bei 6 Wörtern
  const picks = pickPractice(items, {}, streak, { size: 10, rng: seeded(3) });
  assert.equal(picks.length, 10);
  assert.equal(new Set(picks.map((p) => p.item.id)).size, 10);
  for (const p of picks) {
    assert.ok(DIRS.includes(p.dir));
    assert.equal(isSure(keyOf(p.item.id, p.dir), {}, streak), false);
  }
  // Wörter 1–6 sitzen in de-fr, also muss dort fr-de kommen
  for (const p of picks.filter((p) => Number(p.item.id.slice(1)) <= 6)) assert.equal(p.dir, 'fr-de');
});

test('pickPractice: die schwächsten zuerst', () => {
  const srs = {};
  // w1–w5 gut (Box 2, fast sicher), w6–w12 neu
  let st = {};
  for (const it of items.slice(0, 5)) for (const d of DIRS) st = review(st, keyOf(it.id, d), 'correct', NOW);
  Object.assign(srs, st);
  const picks = pickPractice(items, srs, {}, { size: 7, rng: seeded(5) });
  const ids = picks.map((p) => p.item.id);
  for (const it of items.slice(5)) assert.ok(ids.includes(it.id), `${it.id} fehlt`);
});

test('pickPractice: nichts mehr offen gibt eine leere Liste', () => {
  const streak = {};
  for (const it of items) for (const d of DIRS) streak[keyOf(it.id, d)] = 2;
  assert.deepEqual(pickPractice(items, {}, streak), []);
});

test('buildProbe: jedes Wort einmal, gemischt, beide Richtungen kommen vor', () => {
  const probe = buildProbe(items, seeded(9));
  assert.equal(probe.length, 12);
  assert.equal(new Set(probe.map((p) => p.item.id)).size, 12);
  assert.ok(probe.some((p) => p.dir === 'de-fr'));
  assert.ok(probe.some((p) => p.dir === 'fr-de'));
});

test('Probe-Test: Punkte und Schweizer Note', () => {
  assert.equal(probePoints('correct'), 1);
  assert.equal(probePoints('accent'), 0.5);
  assert.equal(probePoints('wrong'), 0);
  assert.equal(swissGrade(10, 10), 6);
  assert.equal(swissGrade(0, 10), 1);
  assert.equal(swissGrade(5, 10), 3.5);
  assert.equal(swissGrade(9, 10), 5.5);
  assert.equal(swissGrade(7, 12), 4); // 1 + 5*7/12 = 3.917, auf Viertel gerundet
  assert.equal(swissGrade(8, 10), 5); // 1 + 5*0.8
  assert.equal(swissGrade(0, 0), 1);
});

test('Note wird lesbar formatiert', () => {
  assert.equal(formatGrade(6), '6');
  assert.equal(formatGrade(5.5), '5.5');
  assert.equal(formatGrade(5.25), '5.25');
  assert.equal(formatGrade(4.75), '4.75');
});

test('countdownText', () => {
  const noon = new Date(2026, 10, 14, 12, 0).getTime();
  assert.equal(countdownText('2026-11-20', noon), 'noch 6 Tage');
  assert.equal(countdownText('2026-11-15', noon), 'morgen!');
  assert.equal(countdownText('2026-11-14', noon), 'heute!');
  assert.equal(countdownText('2026-11-10', noon), 'schon vorbei');
});

test('needsPractice: neu oder fällig', () => {
  assert.equal(needsPractice(undefined, NOW), true);
  assert.equal(needsPractice({ seen: 0, due: 0 }, NOW), true);
  assert.equal(needsPractice({ seen: 2, due: NOW - 1 }, NOW), true);
  assert.equal(needsPractice({ seen: 2, due: NOW + 1000 }, NOW), false);
});
