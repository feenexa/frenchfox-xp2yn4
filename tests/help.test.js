import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointRows, pointRules, streakRules, levelRows, boxRows, prepRules } from '../app/js/help.js';
import { SCORE, LEVELS, SKIP_WINDOW_DAYS } from '../app/js/score.js';
import { INTERVAL_DAYS } from '../app/js/srs.js';

test('Anleitung: Punkte je Antwort stammen aus den Regeln', () => {
  const rows = Object.fromEntries(pointRows().map(([k, v]) => [k, v]));
  assert.equal(rows['Auswählen, richtig'], SCORE.choice);
  assert.equal(rows['Tippen, richtig'], SCORE.type);
  assert.equal(rows['Karteikarte «Gewusst»'], SCORE.cards);
  assert.equal(rows['Falsch oder «Nochmal»'], 0);
});

test('Anleitung: Zahlen der Regeln stehen im Text', () => {
  const text = pointRules().join(' ');
  for (const n of [SCORE.runLength, SCORE.runBonus, SCORE.reviewBonus, SCORE.reviewMinBox, SCORE.perfectBonus, SCORE.perfectMinWords, SCORE.dailyFull]) {
    assert.ok(text.includes(String(n)), `Zahl ${n} fehlt im Text`);
  }
  assert.ok(text.includes(`${Math.round(SCORE.earlyShare * 100)} %`));
  assert.ok(streakRules().join(' ').includes(String(SKIP_WINDOW_DAYS)));
});

test('Anleitung: Level-Tabelle entspricht den Regeln', () => {
  assert.deepEqual(levelRows(), LEVELS.map((l) => [l.level, l.title, l.from]));
});

test('Anleitung: Wiederholungsplan entspricht den Abständen', () => {
  const rows = boxRows();
  assert.equal(rows.length, 5);
  assert.equal(rows[0][1], 'gleich wieder');
  assert.equal(rows[1][1], 'morgen wieder');
  assert.equal(rows[2][1], `nach ${INTERVAL_DAYS[3]} Tagen wieder`);
  assert.equal(rows[4][1], `nach ${INTERVAL_DAYS[5]} Tagen wieder`);
});

test('Hinweis zu den Inhalten: derselbe Text in der Anleitung, auf der Startseite und in der README', async () => {
  const { readFileSync } = await import('node:fs');
  const { LEGAL_NOTICE } = await import('../app/js/help.js');
  assert.match(LEGAL_NOTICE, /private, nicht kommerzielle Lernhilfe/);
  assert.match(LEGAL_NOTICE, /Rechteinhabern/);
  assert.match(LEGAL_NOTICE, /keiner Verbindung zum Verlag/);
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.ok(readme.includes(LEGAL_NOTICE), 'README enthält den Hinweis nicht wortgleich');
  for (const view of ['homeView', 'helpView']) {
    const src = readFileSync(new URL(`../app/js/views/${view}.js`, import.meta.url), 'utf8');
    assert.ok(src.includes('LEGAL_NOTICE'), `${view} zeigt den Hinweis nicht`);
  }
});

test('Anleitung: Testvorbereitung nennt die Bedingung «sitzt»', () => {
  assert.match(prepRules().join(' '), /2-mal hintereinander/);
});
