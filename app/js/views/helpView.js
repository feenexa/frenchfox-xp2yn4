// Anleitung: wie man übt, wie Punkte gezählt werden, Serie, Level, Testvorbereitung.
// Zahlen kommen aus help.js (und damit aus den Konstanten der Regeln).

import { h } from '../ui.js';
import { pointRows, pointRules, streakRules, levelRows, boxRows, prepRules, LEGAL_NOTICE } from '../help.js';

const list = (items) => h('ul', { class: 'help-list' }, items.map((t) => h('li', {}, t)));
const table = (head, rows) => h('table', { class: 'help-table' },
  h('thead', {}, h('tr', {}, head.map((c) => h('th', { scope: 'col' }, c)))),
  h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c) => h('td', {}, String(c)))))));

export function renderHelp(root, ctx) {
  const { show } = ctx;

  root.replaceChildren(
    h('div', { class: 'help' },
      h('header', { class: 'topbar' },
        h('button', { class: 'btn', onClick: () => show('home') }, '← Zurück'),
        h('h1', { class: 'page-title' }, 'So geht’s'),
        h('span', { class: 'topbar-spacer' })),

      h('section', { class: 'panel help-section' },
        h('h2', {}, 'So übst du'),
        list([
          'Wähle auf der Startseite, was du üben willst (Lernziel oder alles), die Richtung und die Übungsart. Dann tippe auf «Los geht’s». Eine Runde hat 10 Wörter.',
          'Auswählen: Du siehst ein Wort und vier Antworten. Tippe die richtige an. Mit den Tasten 1 bis 4 geht es auch.',
          'Tippen: Schreibe die Antwort. Akzente und Umlaute schreibst du mit der Tastatur. Fehlt nur ein Akzent oder bei einem Nomen der Artikel (der, die, das, le, la, l’ …), heisst es «Fast richtig». Ein falscher Artikel ist aber falsch. Mit «Weiss ich nicht» siehst du die Lösung.',
          'Karteikarten: Tippe auf die Karte, um sie umzudrehen. Dann tippst du «Gewusst» oder «Nochmal». Du kannst auch wischen: nach rechts heisst «Gewusst», nach links «Nochmal». Mit der Tastatur dreht die Leertaste um, und die Pfeiltasten bewerten.',
          'Falsche Wörter kommen in der Runde noch einmal. Am Ende siehst du, was du nochmal üben solltest.',
          'Mit 🔊 hörst du das französische Wort. Bei Deutsch → Französisch hörst du es erst nach der Antwort.',
        ])),

      h('section', { class: 'panel help-section' },
        h('h2', {}, 'Wann kommt ein Wort wieder?'),
        h('p', {}, 'Die App merkt sich jedes Wort in einer von fünf Boxen. Richtig bringt es eine Box höher, falsch zurück in Box 1. Je höher die Box, desto länger dauert es, bis das Wort wieder dran ist.'),
        table(['Box', 'Kommt'], boxRows())),

      h('section', { class: 'panel help-section' },
        h('h2', {}, 'So werden Punkte gezählt'),
        table(['Antwort', 'Punkte'], pointRows()),
        list(pointRules())),

      h('section', { class: 'panel help-section' },
        h('h2', {}, 'Serie 🔥'),
        list(streakRules())),

      h('section', { class: 'panel help-section' },
        h('h2', {}, 'Level'),
        h('p', {}, 'Deine Punkte werden zusammengezählt und gehen nie zurück.'),
        table(['Level', 'Titel', 'Ab Punkten'], levelRows())),

      h('section', { class: 'panel help-section' },
        h('h2', {}, 'Test vorbereiten'),
        list(prepRules())),

      h('section', { class: 'panel help-section' },
        h('h2', {}, 'Für Eltern'),
        list([
          'Der Fortschritt steht nur auf diesem Gerät. Unter «Sicherung und Home-Bildschirm» auf der Startseite kannst du ihn als Datei sichern und wieder laden.',
          'Mit «Teilen» → «Zum Home-Bildschirm» wird die App zu einem eigenen Symbol. Dort bleibt der Fortschritt besser erhalten.',
          'Die Wörter stammen aus «dis donc!». Neue Wortlisten ergänzen die Eltern.',
          LEGAL_NOTICE,
        ]))),
  );
}
