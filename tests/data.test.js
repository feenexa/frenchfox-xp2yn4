import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { normalize } from '../app/js/quiz.js';

const dir = new URL('../app/data/units/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json');

test('index.json listet genau die vorhandenen Wortlisten', () => {
  const listed = JSON.parse(readFileSync(new URL('index.json', dir)));
  assert.deepEqual([...listed].sort(), [...files].sort());
});
const TYPES = new Set(['verb', 'adj', 'word', 'phrase', 'sentence']);

test('es gibt mindestens eine Unit', () => {
  assert.ok(files.length > 0);
});

for (const f of files) {
  test(`Wortliste ${f}: Struktur und Pflichtfelder`, () => {
    const unit = JSON.parse(readFileSync(new URL(f, dir)));
    assert.ok(unit.id && unit.title, 'id und title');
    assert.ok(Array.isArray(unit.lernziele) && unit.lernziele.length, 'lernziele');
    const ids = new Set();
    for (const lz of unit.lernziele) {
      assert.ok(lz.id && lz.title && Array.isArray(lz.items) && lz.items.length, `Lernziel ${lz.id}`);
      for (const it of lz.items) {
        assert.ok(!ids.has(it.id), `doppelte id ${it.id}`);
        ids.add(it.id);
        assert.ok(it.id.startsWith(`${unit.id}-${lz.id}-`), `${it.id} gehört nicht zu ${unit.id}/${lz.id}`);
        if (it.deAlt !== undefined) {
          assert.ok(Array.isArray(it.deAlt) && it.deAlt.length && it.deAlt.every((s) => typeof s === 'string' && s.trim()), `${it.id}: deAlt`);
        }
        assert.ok(typeof it.fr === 'string' && it.fr.trim(), `${it.id}: fr`);
        assert.ok(Array.isArray(it.frForms) && it.frForms.length && it.frForms.every((s) => s.trim()), `${it.id}: frForms`);
        assert.ok(Array.isArray(it.de) && it.de.length && it.de.every((s) => s.trim()), `${it.id}: de`);
        assert.ok(TYPES.has(it.type), `${it.id}: type ${it.type}`);
        assert.equal(typeof it.marked, 'boolean', `${it.id}: marked`);
        // Jede tippbare Form muss im Buchtext vorkommen (Schutz vor Tippfehlern beim Erfassen)
        for (const form of it.frForms) {
          assert.ok(normalize(it.fr).includes(normalize(form).slice(0, 4)), `${it.id}: Form ${form} passt nicht zu ${it.fr}`);
        }
      }
    }
  });
}
