import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCORE, LEVELS, createRound, scoreAnswer, perfectBonus, applyDailyCap, todayPoints, addToday,
  levelThreshold, levelFor, levelInfo, levelTitle, legacyLevelFor,
  dayKey, recordDay, streakFor, daysUntil, formatDay,
} from '../app/js/score.js';

const answer = (round, opts) => scoreAnswer(round, { firstTry: true, mode: 'choice', result: 'correct', boxBefore: 0, ...opts });

// ---- Punkte ----

test('Punkte: Auswählen 10, Tippen 20, fast richtig 10, Karte 5, falsch 0', () => {
  assert.equal(answer(createRound(), {}).gained, 10);
  assert.equal(answer(createRound(), { mode: 'type' }).gained, 20);
  assert.equal(answer(createRound(), { mode: 'type', result: 'accent' }).gained, 10);
  assert.equal(answer(createRound(), { mode: 'cards' }).gained, 5);
  assert.equal(answer(createRound(), { result: 'wrong' }).gained, 0);
});

test('Wort, das heute nicht dran ist, gibt nur 20 % (mindestens 1), ohne Boni', () => {
  const early = (opts) => answer(createRound(), { eligible: false, ...opts });
  assert.equal(early({}).gained, 2);
  assert.equal(early({ mode: 'type' }).gained, 4);
  assert.equal(early({ mode: 'cards' }).gained, 1);
  assert.equal(early({ mode: 'choice', boxBefore: 4 }).review, 0);
  // zählt nicht für die Serie
  let r = createRound();
  for (let i = 0; i < 8; i++) r = answer(r, { eligible: false }).round;
  assert.equal(r.run, 0);
});

test('Serie: jede fünfte richtige Antwort in Folge gibt +5', () => {
  let r = createRound();
  const gains = [];
  for (let i = 0; i < 10; i++) {
    const s = answer(r, {});
    gains.push(s.gained);
    r = s.round;
  }
  assert.deepEqual(gains, [10, 10, 10, 10, 15, 10, 10, 10, 10, 15]);
  assert.equal(r.points, 110);
});

test('Serie: falsch setzt zurück, kein Abzug', () => {
  let r = createRound();
  for (let i = 0; i < 4; i++) r = answer(r, {}).round;
  const wrong = answer(r, { result: 'wrong' });
  assert.equal(wrong.gained, 0);
  assert.equal(wrong.round.points, 40);
  assert.equal(wrong.round.run, 0);
  assert.equal(answer(wrong.round, {}).runBonus, 0);
});

test('Zweiter Versuch gibt keine Punkte und verändert die Serie nicht', () => {
  const r = answer(createRound(), {}).round;
  const again = scoreAnswer(r, { mode: 'choice', result: 'correct', boxBefore: 1, firstTry: false });
  assert.equal(again.gained, 0);
  assert.deepEqual(again.round, r);
  const againWrong = scoreAnswer(r, { mode: 'choice', result: 'wrong', boxBefore: 1, firstTry: false });
  assert.equal(againWrong.round.run, 1);
});

test('Wiederholungs-Bonus ab Box 3, nur bei vollständig richtig und fälligem Wort', () => {
  assert.equal(answer(createRound(), { boxBefore: 2 }).review, 0);
  assert.equal(answer(createRound(), { boxBefore: 3 }).review, SCORE.reviewBonus);
  assert.equal(answer(createRound(), { boxBefore: 3 }).gained, 15);
  assert.equal(answer(createRound(), { boxBefore: 4, mode: 'type', result: 'accent' }).review, 0);
});

test('Karteikarten: keine Boni, Serie des Quiz bleibt unberührt', () => {
  let r = { ...createRound(), run: 2 };
  for (let i = 0; i < 4; i++) {
    const s = answer(r, { mode: 'cards', boxBefore: 4 });
    assert.equal(s.gained, SCORE.cards);
    assert.equal(s.review, 0);
    assert.equal(s.runBonus, 0);
    r = s.round;
  }
  assert.equal(r.points, 20);
  assert.equal(r.run, 2);
  const again = answer(r, { mode: 'cards', result: 'wrong' });
  assert.equal(again.gained, 0);
  assert.equal(again.round.run, 2);
});

test('scoreAnswer verändert den alten Zustand nicht', () => {
  const r = createRound();
  answer(r, {});
  assert.deepEqual(r, { points: 0, run: 0, answered: 0, eligible: 0 });
});

test('Runde zählt Antworten und wie viele davon neu oder fällig waren', () => {
  let r = createRound();
  r = answer(r, {}).round;
  r = answer(r, { eligible: false }).round;
  r = answer(r, { result: 'wrong' }).round;
  assert.equal(r.answered, 3);
  assert.equal(r.eligible, 2);
});

// ---- Tageslimit ----

test('Tageslimit: bis 200 voll, danach halb (aufgerundet)', () => {
  assert.deepEqual(applyDailyCap(20, 0), { gained: 20, halved: false });
  assert.deepEqual(applyDailyCap(20, 180), { gained: 20, halved: false });
  assert.deepEqual(applyDailyCap(20, 190), { gained: 15, halved: true }); // 10 voll + 10/2
  assert.deepEqual(applyDailyCap(20, 200), { gained: 10, halved: true });
  assert.deepEqual(applyDailyCap(5, 250), { gained: 3, halved: true });
});

test('Tageslimit wirkt in scoreAnswer', () => {
  const s = answer(createRound(), { mode: 'type', todayPoints: 200 });
  assert.equal(s.gained, 10);
  assert.equal(s.halved, true);
  assert.equal(s.round.points, 10);
});

test('Tagespunkte: gelten nur für den heutigen Tag', () => {
  const NOON = new Date(2026, 10, 14, 12, 0).getTime();
  const DAY = 86400000;
  let d = addToday({ day: '', points: 0 }, 30, NOON);
  d = addToday(d, 20, NOON);
  assert.deepEqual(d, { day: '2026-11-14', points: 50 });
  assert.equal(todayPoints(d, NOON), 50);
  assert.equal(todayPoints(d, NOON + DAY), 0);
  assert.deepEqual(addToday(d, 5, NOON + DAY), { day: '2026-11-15', points: 5 });
  assert.equal(todayPoints(undefined, NOON), 0);
});

// ---- Perfekte Runde ----

test('Perfekte Runde: +20 ab 5 Wörtern ohne Fehler, wenn mindestens die Hälfte neu oder fällig war', () => {
  assert.equal(perfectBonus({ total: 10, wrongCount: 0, eligible: 10 }), 20);
  assert.equal(perfectBonus({ total: 10, wrongCount: 0, eligible: 5 }), 20);
  assert.equal(perfectBonus({ total: 10, wrongCount: 0, eligible: 4 }), 0);
  assert.equal(perfectBonus({ total: 5, wrongCount: 0 }), 20);
  assert.equal(perfectBonus({ total: 4, wrongCount: 0, eligible: 4 }), 0);
  assert.equal(perfectBonus({ total: 10, wrongCount: 1, eligible: 10 }), 0);
  assert.equal(perfectBonus({ total: 10, wrongCount: 0, mode: 'cards', eligible: 10 }), 0);
});

// ---- Level ----

test('Level-Schwellen und Titel', () => {
  assert.deepEqual(LEVELS.map((l) => l.from), [0, 150, 500, 1200, 2500, 4500, 7500, 12000, 18000, 26000]);
  assert.deepEqual([1, 2, 5, 10].map(levelThreshold), [0, 150, 2500, 26000]);
  assert.equal(levelThreshold(11), 36000);
  assert.equal(levelThreshold(12), 46000);
  assert.equal(levelTitle(1), 'Fuchsjunges');
  assert.equal(levelTitle(5), 'Vokabel-Profi');
  assert.equal(levelTitle(8), 'Grand Renard');
  assert.equal(levelTitle(10), 'Légende');
  assert.equal(levelTitle(15), 'Légende');
});

test('levelFor und levelInfo', () => {
  assert.equal(levelFor(0), 1);
  assert.equal(levelFor(149), 1);
  assert.equal(levelFor(150), 2);
  assert.equal(levelFor(2499), 4);
  assert.equal(levelFor(2500), 5);
  assert.equal(levelFor(26000), 10);
  assert.equal(levelFor(36000), 11);
  const info = levelInfo(325);
  assert.equal(info.level, 2);
  assert.equal(info.title, 'Neugieriger Fuchs');
  assert.equal(info.toNext, 175);
  assert.equal(info.fraction, 0.5);
});

test('Stand aus Version 1: altes Level wird erkannt', () => {
  assert.equal(legacyLevelFor(0), 1);
  assert.equal(legacyLevelFor(99), 1);
  assert.equal(legacyLevelFor(100), 2);
  assert.equal(legacyLevelFor(1000), 5);
  assert.equal(legacyLevelFor(1499), 5);
  assert.equal(legacyLevelFor(1500), 6);
});

// ---- Serie ----
const NOON = new Date(2026, 10, 13, 12, 0).getTime();
const DAY = 86400000;
const daysAgo = (...offsets) => offsets.map((n) => dayKey(NOON - n * DAY));
const streak = (...offsets) => streakFor(daysAgo(...offsets), NOON);

test('dayKey: lokaler Kalendertag', () => {
  assert.equal(dayKey(NOON), '2026-11-13');
  assert.equal(dayKey(new Date(2026, 0, 5, 0, 5).getTime()), '2026-01-05');
});

test('Tage bis zu einem Datum und Anzeige', () => {
  assert.equal(daysUntil('2026-11-13', NOON), 0);
  assert.equal(daysUntil('2026-11-20', NOON), 7);
  assert.equal(daysUntil('2026-11-10', NOON), -3);
  assert.equal(formatDay('2026-11-20'), 'Fr 20.11.');
  assert.equal(formatDay('2026-01-05'), 'Mo 5.1.');
});

test('recordDay: einmal pro Tag, sortiert', () => {
  let d = recordDay([], NOON);
  d = recordDay(d, NOON);
  d = recordDay(d, NOON - DAY);
  assert.deepEqual(d, ['2026-11-12', '2026-11-13']);
});

test('Serie: ohne Tage, nur heute, nur gestern', () => {
  assert.equal(streak(), 0);
  assert.equal(streak(0), 1);
  assert.equal(streak(1), 1);
});

test('Serie: aufeinanderfolgende Tage', () => {
  assert.equal(streak(0, 1, 2), 3);
  assert.equal(streak(1, 2, 3, 4), 4);
});

test('Serie: ein verpasster Tag wird verziehen, zählt aber nicht mit', () => {
  assert.equal(streak(0, 2), 2);
  assert.equal(streak(2, 3), 2);
});

test('Serie: zwei verpasste Tage in Folge beenden sie', () => {
  assert.equal(streak(0, 3), 1);
  assert.equal(streak(3), 0);
  assert.equal(streak(2), 1);
});

test('Serie: zweiter Verzeih-Tag erst nach 7 Tagen wieder', () => {
  assert.equal(streak(0, 2, 4), 2);
  assert.equal(streak(0, 2, 3, 4, 5, 6, 7, 8, 10), 9);
  assert.equal(streak(0, 2, 3, 4, 5, 6, 8), 6);
});
