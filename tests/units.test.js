// Prüft alle Wortlisten zusammen: eindeutige IDs über alle Units, alternative Lösungen,
// und dass die Quizlogik mit allen Wörtern in beiden Richtungen funktioniert.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { normalize, checkAnswer, acceptedAnswers, makeChoices } from '../app/js/quiz.js';

const dir = new URL('../app/data/units/', import.meta.url);
const units = readdirSync(dir)
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .map((f) => JSON.parse(readFileSync(new URL(f, dir))));
const items = units.flatMap((u) => u.lernziele.flatMap((l) => l.items));
const byId = (id) => items.find((i) => i.id === id);

function seeded(seed = 1) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

test('Wortlisten: Unit-IDs eindeutig, Wort-IDs über alle Units eindeutig', () => {
  assert.equal(new Set(units.map((u) => u.id)).size, units.length);
  assert.equal(new Set(items.map((i) => i.id)).size, items.length);
  assert.ok(items.length >= 100, `nur ${items.length} Wörter`);
});

test('Wortlisten: Unité 2 und 3 mit ihren Lernzielen', () => {
  const lz = (u) => units.find((x) => x.id === u).lernziele.map((l) => `${l.id}:${l.items.length}`);
  assert.deepEqual(lz('u2'), ['lz2:20', 'lz3:22']);
  assert.deepEqual(lz('u3'), ['lz1:28', 'lz2:8', 'lz3:22', 'lz4:30']);
});

test('Alternative Lösungen (deAlt) gelten beim Tippen', () => {
  const afrika = acceptedAnswers(byId('u3-lz2-03'), 'fr-de'); // in/nach Afrika
  for (const ok of ['in Afrika', 'nach Afrika', 'in/nach Afrika', 'In Afrika']) {
    assert.equal(checkAnswer(ok, afrika, 'de').result, 'correct', ok);
  }
  assert.equal(checkAnswer('aus Afrika', afrika, 'de').result, 'wrong');
  const erste = acceptedAnswers(byId('u3-lz1-03'), 'fr-de');
  for (const ok of ['erste', 'erster', 'erstes', 'erste/r/s']) assert.equal(checkAnswer(ok, erste, 'de').result, 'correct', ok);
  const warm = acceptedAnswers(byId('u3-lz1-11'), 'fr-de'); // Es ist heiss/warm.
  assert.equal(checkAnswer('Es ist warm.', warm, 'de').result, 'correct');
  assert.equal(checkAnswer('es ist heiss', warm, 'de').result, 'correct');
});

test('Sonnenbrille: die Mehrzahl «Sonnenbrillen» gilt auch', () => {
  const acc = acceptedAnswers(byId('u3-lz4-28'), 'fr-de');
  assert.equal(checkAnswer('die Sonnenbrille', acc, 'de').result, 'correct');
  assert.equal(checkAnswer('die Sonnenbrillen', acc, 'de').result, 'correct');
});

test('Artikel: bei allen Nomen gilt eine Antwort ohne Artikel als «fast richtig», ein falscher Artikel nicht', () => {
  const nouns = items.filter((i) => i.type === 'word');
  assert.ok(nouns.length > 40, `nur ${nouns.length} Nomen`);
  let checked = 0;
  for (const it of nouns) {
    // Deutsch: Lösungen mit Artikel
    for (const de of it.de.filter((d) => /^(der|die|das|ein|eine) /i.test(d))) {
      const acc = acceptedAnswers(it, 'fr-de');
      const bare = de.replace(/^(der|die|das|ein|eine) /i, '');
      const r = checkAnswer(bare, acc, 'de', { articles: true });
      assert.equal(r.result, 'accent', `${it.id}: «${bare}»`);
      assert.equal(r.reason, 'article', it.id);
      assert.equal(checkAnswer(bare, acc, 'de').result, 'wrong', `${it.id}: ohne Option bleibt es falsch`);
      checked += 1;
    }
    // Französisch: Formen mit Artikel
    for (const fr of it.frForms.filter((f) => /^(le|la|les|un|une|des) |^l['’]/i.test(f))) {
      const acc = acceptedAnswers(it, 'de-fr');
      const bare = fr.replace(/^(?:(?:le|la|les|un|une|des) |l['’])/i, '');
      const r = checkAnswer(bare, acc, 'fr', { articles: true });
      assert.equal(r.result, 'accent', `${it.id}: «${bare}»`);
      assert.equal(r.reason, 'article', it.id);
      checked += 1;
    }
  }
  assert.ok(checked > 60, `nur ${checked} Fälle`);
});

test('Artikel: falscher Artikel, Sätze und Wendungen bleiben streng', () => {
  const planet = acceptedAnswers(byId('u3-lz1-02'), 'fr-de'); // der Planet
  assert.equal(checkAnswer('die Planet', planet, 'de', { articles: true }).result, 'wrong');
  assert.equal(checkAnswer('das Planet', planet, 'de', { articles: true }).result, 'wrong');
  assert.equal(checkAnswer('Planet', planet, 'de', { articles: true }).reason, 'article');
  // Wendungen (type phrase) werden vom Aufrufer ohne Option geprüft: «Sprache lernen» bleibt falsch
  const sprache = acceptedAnswers(byId('u3-lz1-04'), 'fr-de'); // eine Sprache lernen
  assert.equal(checkAnswer('Sprache lernen', sprache, 'de').result, 'wrong');
});

test('Artikel: Elision l’eau, Akzent und Artikel zugleich, Komma-Liste', () => {
  const eau = acceptedAnswers(byId('u3-lz1-14'), 'de-fr');
  assert.equal(checkAnswer('eau', eau, 'fr', { articles: true }).reason, 'article');
  assert.equal(checkAnswer("l'eau", eau, 'fr', { articles: true }).result, 'correct');
  const etoile = acceptedAnswers(byId('u3-lz1-24'), 'de-fr'); // une étoile
  const r = checkAnswer('etoile', etoile, 'fr', { articles: true }); // Artikel und Akzent fehlen
  assert.equal(r.result, 'accent');
  assert.equal(r.reason, 'article');
  const zimmer = acceptedAnswers(byId('u3-lz1-22'), 'fr-de'); // das Zimmer, das Schlafzimmer
  assert.equal(checkAnswer('Zimmer, Schlafzimmer', zimmer, 'de', { articles: true }).reason, 'article');
  assert.equal(checkAnswer('das Zimmer, das Schlafzimmer', zimmer, 'de', { articles: true }).result, 'correct');
  const tag = acceptedAnswers(byId('u3-lz1-26'), 'fr-de'); // der Tag, am Tag
  assert.equal(checkAnswer('Tag', tag, 'de', { articles: true }).reason, 'article');
});

test('deAlt wird nicht als Auswahlantwort oder Frage angezeigt', () => {
  const it = byId('u3-lz2-03');
  const { options } = makeChoices(it, items, 'fr-de', { rng: seeded(2) });
  assert.equal(options.find((o) => o.correct).text, 'in/nach Afrika');
});

test('Geschlechtshinweise wie «(f)» muss man nicht mittippen', () => {
  const eau = acceptedAnswers(byId('u3-lz1-14'), 'de-fr');
  assert.equal(checkAnswer('l’eau', eau, 'fr').result, 'correct');
  assert.equal(checkAnswer("l'eau", eau, 'fr').result, 'correct');
  assert.equal(checkAnswer('l’eau (f)', eau, 'fr').result, 'correct');
  const jeux = acceptedAnswers(byId('u3-lz4-29'), 'de-fr');
  assert.equal(checkAnswer('les jeux', jeux, 'fr').result, 'correct');
});

for (const dirName of ['de-fr', 'fr-de']) {
  test(`Auswahl ${dirName} mit allen Wörtern aller Units: vier Optionen, keine Doppelten, keine zweite richtige`, () => {
    const rng = seeded(11);
    for (const it of items) {
      const { options } = makeChoices(it, items, dirName, { rng });
      assert.equal(options.length, 4, it.id);
      assert.equal(options.filter((o) => o.correct).length, 1, it.id);
      assert.equal(new Set(options.map((o) => normalize(o.text))).size, 4, `Dopplung bei ${it.id}`);
      const accepted = new Set(acceptedAnswers(it, dirName).map(normalize));
      for (const o of options.filter((x) => !x.correct)) {
        assert.ok(!accepted.has(normalize(o.text)), `${it.id}: «${o.text}» wäre auch richtig`);
      }
    }
  });
}

test('Gleiche Wörter in verschiedenen Lernzielen (beau/belle) sind getrennte Einträge', () => {
  const beau = items.filter((i) => i.fr === 'beau/belle');
  assert.equal(beau.length, 2);
  assert.notEqual(beau[0].id, beau[1].id);
});
