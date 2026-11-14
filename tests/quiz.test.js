import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalize, checkAnswer, acceptedAnswers, makeChoices, answerLang, questionText, solutionText } from '../app/js/quiz.js';

const unit = JSON.parse(readFileSync(new URL('../app/data/units/unite-2.json', import.meta.url)));
const items = unit.lernziele.flatMap((l) => l.items);
const byId = (id) => items.find((i) => i.id === id);

// einfacher, wiederholbarer Zufall
function seeded(seed = 1) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

test('normalize: Gross/Klein, Apostroph, ß, Satzzeichen, Leerzeichen', () => {
  assert.equal(normalize('  J’aimerais  '), "j'aimerais");
  assert.equal(normalize('Je vais à la piscine.'), 'je vais à la piscine');
  assert.equal(normalize('Fussball  spielen'), 'fussball spielen');
  assert.equal(normalize('Fußball spielen'), 'fussball spielen');
});

test('Französisch tippen: richtig, Akzent fehlt, falsch, leer', () => {
  const it = byId('u2-lz2-13'); // ordonné/e
  const acc = acceptedAnswers(it, 'de-fr');
  assert.equal(checkAnswer('ordonné', acc, 'fr').result, 'correct');
  assert.equal(checkAnswer('Ordonnée', acc, 'fr').result, 'correct');
  assert.equal(checkAnswer('ordonné/e', acc, 'fr').result, 'correct');
  assert.equal(checkAnswer('ordonne', acc, 'fr').result, 'accent');
  assert.equal(checkAnswer('ordone', acc, 'fr').result, 'wrong');
  assert.equal(checkAnswer('   ', acc, 'fr').result, 'empty');
});

test('Französisch: gerader und typografischer Apostroph gelten gleich', () => {
  const acc = acceptedAnswers(byId('u2-lz2-17'), 'de-fr');
  assert.equal(checkAnswer("j'aimerais", acc, 'fr').result, 'correct');
  assert.equal(checkAnswer('j’aimerais', acc, 'fr').result, 'correct');
  const acc2 = acceptedAnswers(byId('u2-lz3-16'), 'de-fr');
  assert.equal(checkAnswer("faire de l'equitation", acc2, 'fr').result, 'accent');
});

test('Deutsch tippen: mehrere Bedeutungen, Umlaut-Schreibweise, Komma-Liste', () => {
  const acc = acceptedAnswers(byId('u2-lz2-10'), 'fr-de'); // ehrlich, aufrichtig, anständig
  assert.equal(checkAnswer('aufrichtig', acc, 'de').result, 'correct');
  assert.equal(checkAnswer('anstaendig', acc, 'de').result, 'accent');
  assert.equal(checkAnswer('ehrlich, aufrichtig', acc, 'de').result, 'correct');
  assert.equal(checkAnswer('ehrlich, falsch', acc, 'de').result, 'wrong');
  assert.equal(checkAnswer('lustig', acc, 'de').result, 'wrong');
  const fr = acceptedAnswers(byId('u2-lz2-07'), 'fr-de'); // fröhlich
  assert.equal(checkAnswer('froehlich', fr, 'de').result, 'accent');
  assert.equal(checkAnswer('frohlich', fr, 'de').result, 'wrong');
});

test('Deutsch: Fussball / Fußball und Gross/Klein', () => {
  const acc = acceptedAnswers(byId('u2-lz3-08'), 'fr-de');
  assert.equal(checkAnswer('fußball spielen', acc, 'de').result, 'correct');
  assert.equal(checkAnswer('FUSSBALL SPIELEN', acc, 'de').result, 'correct');
});

test('Sätze: Schlusspunkt egal', () => {
  const acc = acceptedAnswers(byId('u2-lz3-01'), 'de-fr');
  assert.equal(checkAnswer('je vais à la piscine', acc, 'fr').result, 'correct');
  assert.equal(checkAnswer('Je vais a la piscine!', acc, 'fr').result, 'accent');
});

test('Sprache je Richtung', () => {
  assert.equal(answerLang('de-fr'), 'fr');
  assert.equal(answerLang('fr-de'), 'de');
  assert.equal(questionText(byId('u2-lz2-10'), 'fr-de'), 'honnête/-');
  assert.equal(questionText(byId('u2-lz2-10'), 'de-fr'), 'ehrlich / aufrichtig / anständig');
  assert.equal(solutionText(byId('u2-lz2-07'), 'de-fr'), 'joyeux/euse');
});

for (const dir of ['de-fr', 'fr-de']) {
  test(`Auswahl ${dir}: 4 Optionen, genau eine richtig, keine Dopplung, für jeden Eintrag`, () => {
    const rng = seeded(7);
    for (const it of items) {
      const { options, correctIndex } = makeChoices(it, items, dir, { rng });
      assert.equal(options.length, 4, it.id);
      assert.equal(options.filter((o) => o.correct).length, 1, it.id);
      assert.ok(options[correctIndex].correct, it.id);
      const texts = options.map((o) => normalize(o.text));
      assert.equal(new Set(texts).size, 4, `Dopplung bei ${it.id}: ${texts}`);
      // keine falsche Option darf eine akzeptierte Antwort sein
      const accepted = new Set(acceptedAnswers(it, dir).map(normalize));
      for (const o of options.filter((x) => !x.correct)) {
        assert.ok(!accepted.has(normalize(o.text)), `${it.id}: falsche Option ist eigentlich richtig: ${o.text}`);
      }
    }
  });
}

test('Auswahl: bevorzugt gleichen Typ', () => {
  const it = byId('u2-lz2-02'); // Adjektiv
  const { options } = makeChoices(it, items, 'fr-de', { rng: seeded(3) });
  const adjDe = new Set(items.filter((i) => i.type === 'adj').map((i) => i.de[0]));
  for (const o of options) assert.ok(adjDe.has(o.text), o.text);
});

test('Auswahl: kleiner Pool liefert weniger Optionen statt Fehler', () => {
  const pool = items.slice(0, 2);
  const { options } = makeChoices(pool[0], pool, 'de-fr');
  assert.equal(options.length, 2);
});
