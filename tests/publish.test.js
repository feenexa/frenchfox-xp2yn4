// Schutz vor dem Veröffentlichen: nicht auffindbar für Suchmaschinen, Tests vor dem Deploy,
// keine Projektdokumente und keine persönlichen Angaben in den Dateien, die ins öffentliche Repo kommen.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');

test('Suchmaschinen: robots.txt sperrt alles, die Seiten tragen noindex', () => {
  assert.match(read('app/robots.txt'), /User-agent:\s*\*\s*\nDisallow:\s*\/\s*\n/);
  for (const page of ['app/index.html', 'app/test_speech.html']) {
    assert.match(read(page), /<meta name="robots" content="[^"]*noindex[^"]*">/, page);
  }
});

test('Workflow: Tests laufen vor dem Deploy, veröffentlicht wird nur app/', () => {
  const wf = read('.github/workflows/pages.yml');
  assert.match(wf, /branches:\s*\[main\]/);
  assert.match(wf, /run:\s*npm test/);
  assert.match(wf, /needs:\s*test/);
  assert.match(wf, /path:\s*app\s*$/m);
  assert.match(wf, /actions\/deploy-pages@v\d+/);
  assert.match(wf, /pages:\s*write/);
  assert.doesNotMatch(wf, /secrets\./, 'keine Secrets nötig');
});

test('.gitignore: Dokumente, Arbeitsordner, Sicherungen und Geheimnisse bleiben draussen', () => {
  const ignore = read('.gitignore').split('\n').map((l) => l.trim());
  for (const must of ['CLAUDE.md', 'CONTEXT.md', 'TODO.md', 'docs/', '.claude/', '.scratch/', '*sicherung*.json', '.env', 'secrets.toml', '*.db', 'assets/']) {
    assert.ok(ignore.includes(must), `.gitignore fehlt: ${must}`);
  }
});

// Dateien, die veröffentlicht werden (ohne Binärdateien)
function publicFiles() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (/\.(png|jpg|ico)$/.test(name)) continue;
      out.push(relative(root, p));
    }
  };
  for (const d of ['app', 'tests', '.github']) walk(join(root, d));
  for (const f of ['serve.py', 'package.json', 'README.md']) out.push(f);
  return out;
}

test('Öffentliche Dateien enthalten keine persönlichen Angaben oder Zugangsdaten', () => {
  // Muster in Stücken geschrieben, damit sich diese Datei nicht selbst findet
  const forbidden = [
    ['Toch', 'ter'], ['192', '\\.168'], ['andr', 'eas'], ['hue', 'tt'], ['feenexa', '\\.com'],
    ['ghp', '_'], ['github', '_pat_'], ['sk-', 'ant'], ['postgres', ':\\/\\/'], ['BEGIN [A-Z ]*PRIVATE', ' KEY'],
  ].map(([a, b]) => new RegExp(a + b, 'i'));
  const files = publicFiles().filter((f) => f !== 'tests/publish.test.js');
  assert.ok(files.length > 30, `nur ${files.length} Dateien gefunden`);
  for (const f of files) {
    const text = read(f);
    for (const re of forbidden) assert.doesNotMatch(text, re, `${f}: Treffer für ${re}`);
  }
});

test('Veröffentlichte Dateien sind klein (keine versehentlichen Datenbanken oder Archive)', () => {
  for (const f of publicFiles()) {
    assert.ok(statSync(join(root, f)).size < 1_000_000, `${f} ist über 1 MB`);
  }
  assert.ok(!existsSync(join(root, 'app/data/progress.json')));
});
