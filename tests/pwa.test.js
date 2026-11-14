import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const app = new URL('../app/', import.meta.url).pathname;
const swText = readFileSync(join(app, 'sw.js'), 'utf8');
const shell = [...swText.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

test('Service Worker: jede Datei der Liste existiert', () => {
  for (const f of shell) {
    const path = f === './' ? 'index.html' : f;
    assert.ok(existsSync(join(app, path)), `fehlt: ${f}`);
  }
});

test('Service Worker: alle Skripte der App stehen in der Liste (sonst nicht offline)', () => {
  const files = [
    ...readdirSync(join(app, 'js')).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
    ...readdirSync(join(app, 'js/views')).filter((f) => f.endsWith('.js')).map((f) => `js/views/${f}`),
    'css/theme.css',
    'index.html',
  ];
  for (const f of files) assert.ok(shell.includes(f), `nicht im Service Worker: ${f}`);
});

test('Manifest: Pflichtfelder und vorhandene Icons', () => {
  const m = JSON.parse(readFileSync(join(app, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.display, 'standalone');
  assert.ok(m.name && m.short_name && m.start_url && m.background_color && m.theme_color);
  for (const icon of m.icons) assert.ok(existsSync(join(app, icon.src)), `Icon fehlt: ${icon.src}`);
  assert.ok(m.icons.some((i) => i.sizes === '512x512'));
  assert.ok(m.icons.some((i) => i.sizes === '192x192'));
});

test('index.html: verweist auf Manifest und Apple-Icon', () => {
  const html = readFileSync(join(app, 'index.html'), 'utf8');
  assert.match(html, /rel="manifest"/);
  assert.match(html, /rel="apple-touch-icon"/);
  assert.ok(existsSync(join(app, 'icons/apple-touch-icon.png')));
});
