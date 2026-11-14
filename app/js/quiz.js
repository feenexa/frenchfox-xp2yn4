// Kernlogik der Abfrage: Bewertung von Antworten und Auswahlmöglichkeiten.
// Kein DOM-Zugriff, damit testbar.
//
// Richtungen: 'de-fr' (Frage Deutsch, Antwort Französisch) und 'fr-de'.
// Bewertung: 'correct' | 'accent' (Buchstaben stimmen, nur Akzent/Umlaut falsch) | 'wrong' | 'empty'

export const DIRECTIONS = ['de-fr', 'fr-de'];

/** Vereinheitlicht Text für den Vergleich (Gross/Klein, Apostrophe, ß, Satzzeichen am Ende, Leerzeichen). */
export function normalize(s) {
  return String(s ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?¿¡,;:]+$/g, '')
    .trim();
}

/** Entfernt Akzente (Französisch) bzw. ersetzt Umlaute (Deutsch), um «fast richtig» zu erkennen. */
export function fold(s, lang) {
  let t = s;
  if (lang === 'de') t = t.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue');
  if (lang === 'fr') t = t.replace(/œ/g, 'oe').replace(/æ/g, 'ae');
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Sprache der Antwort je Richtung. */
export function answerLang(dir) {
  return dir === 'de-fr' ? 'fr' : 'de';
}

/** Alle als richtig geltenden Antworten eines Eintrags. */
export function acceptedAnswers(item, dir) {
  if (dir === 'de-fr') return [...new Set([...item.frForms, item.fr])];
  // deAlt: weitere gültige Schreibweisen, die nicht angezeigt werden (z. B. «in Afrika» für «in/nach Afrika»)
  return [...item.de, ...(item.deAlt ?? [])];
}

const ARTICLES = {
  de: /^(?:der|die|das|ein|eine) /,
  fr: /^(?:(?:le|la|les|un|une|des) |l')/,
};

/** Entfernt einen Artikel am Anfang (normalisierter Text): «der planet» → «planet», «l'eau» → «eau». */
export function stripArticle(n, lang) {
  return n.replace(ARTICLES[lang] ?? /^$/, '');
}

/**
 * Bewertet eine einzelne Antwort. Ergebnis:
 *  correct | accent (+ reason) | wrong | empty
 * reason bei «accent»: 'accent' (nur Akzent/Umlaut falsch) oder 'article' (nur der Artikel fehlt).
 * opts.articles: bei Nomen gilt eine Antwort ohne Artikel als «fast richtig» (ein falscher Artikel bleibt falsch).
 */
function checkOne(input, accepted, lang, opts = {}) {
  const n = normalize(input);
  if (!n) return { result: 'empty' };
  for (const a of accepted) {
    if (normalize(a) === n) return { result: 'correct', matched: a };
  }
  const fn = fold(n, lang);
  for (const a of accepted) {
    if (fold(normalize(a), lang) === fn) return { result: 'accent', reason: 'accent', matched: a };
  }
  if (opts.articles) {
    for (const a of accepted) {
      const na = normalize(a);
      const sa = stripArticle(na, lang);
      if (sa === na) continue; // diese Lösung hat keinen Artikel
      if (n === sa || fn === fold(sa, lang)) return { result: 'accent', reason: 'article', matched: a };
    }
  }
  return { result: 'wrong' };
}

/**
 * Bewertet eine getippte oder gesprochene Antwort.
 * Mehrere durch Komma getrennte Antworten («ehrlich, aufrichtig») gelten, wenn jede einzelne passt.
 */
export function checkAnswer(input, accepted, lang, opts = {}) {
  const whole = checkOne(input, accepted, lang, opts);
  if (whole.result !== 'wrong' || !/[,;]/.test(String(input))) return whole;

  const parts = String(input).split(/[,;]/).filter((p) => normalize(p));
  if (parts.length < 2) return whole;
  const results = parts.map((p) => checkOne(p, accepted, lang, opts));
  if (results.some((r) => r.result === 'wrong')) return { result: 'wrong' };
  const near = results.filter((r) => r.result === 'accent');
  if (near.length) return { result: 'accent', reason: near.some((r) => r.reason === 'article') ? 'article' : 'accent' };
  return { result: 'correct' };
}

/** Text der Frage je Richtung. */
export function questionText(item, dir) {
  return dir === 'de-fr' ? item.de.join(' / ') : item.fr;
}

/** Text, der bei der Auflösung als Lösung gezeigt wird. */
export function solutionText(item, dir) {
  return dir === 'de-fr' ? item.fr : item.de.join(' / ');
}

function choiceText(item, dir) {
  return dir === 'de-fr' ? item.fr : item.de[0];
}

export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Baut Auswahlmöglichkeiten: eine richtige und bis zu count-1 falsche.
 * Falsche bevorzugt vom gleichen Typ (Adjektiv bei Adjektiv). Nie dieselbe Lösung doppelt.
 */
export function makeChoices(item, pool, dir, { count = 4, rng = Math.random } = {}) {
  const correct = choiceText(item, dir);
  const correctKeys = new Set(acceptedAnswers(item, dir).map(normalize));
  const seen = new Set([normalize(correct)]);

  const usable = pool.filter((o) => {
    if (o.id === item.id) return false;
    const t = normalize(choiceText(o, dir));
    const clashes = acceptedAnswers(o, dir).length && correctKeys.has(t);
    return !clashes;
  });
  const sameType = shuffle(usable.filter((o) => o.type === item.type), rng);
  const others = shuffle(usable.filter((o) => o.type !== item.type), rng);

  const distractors = [];
  for (const o of [...sameType, ...others]) {
    if (distractors.length >= count - 1) break;
    const text = choiceText(o, dir);
    const key = normalize(text);
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(text);
  }

  const options = shuffle(
    [{ text: correct, correct: true }, ...distractors.map((text) => ({ text, correct: false }))],
    rng,
  );
  return { options, correctIndex: options.findIndex((o) => o.correct) };
}
