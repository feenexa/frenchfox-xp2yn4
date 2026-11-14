// Texte der Anleitung, soweit sie Zahlen aus den Regeln nennen.
// Alle Zahlen kommen aus den Konstanten in score.js, srs.js und prep.js,
// damit die Anleitung nie von den Regeln abweicht.

import { SCORE, LEVELS, SKIP_WINDOW_DAYS } from './score.js';
import { INTERVAL_DAYS, MAX_BOX } from './srs.js';
import { SURE_STREAK, SURE_BOX } from './prep.js';

const pct = (x) => `${Math.round(x * 100)} %`;

/** Hinweis zu den Inhalten. Steht auf der Startseite, in der Anleitung und in der README (Test prüft das). */
export const LEGAL_NOTICE = 'FrenchFox ist eine private, nicht kommerzielle Lernhilfe. Die Wörter folgen dem Lehrmittel «dis donc!»; die Rechte an den Inhalten liegen bei den Rechteinhabern. FrenchFox steht in keiner Verbindung zum Verlag.';

/** Punkte je Übungsart: [Beschreibung, Punkte] */
export function pointRows() {
  return [
    ['Auswählen, richtig', SCORE.choice],
    ['Tippen, richtig', SCORE.type],
    ['Tippen, nur ein Akzent fehlt («Fast richtig»)', SCORE.near],
    ['Karteikarte «Gewusst»', SCORE.cards],
    ['Falsch oder «Nochmal»', 0],
  ];
}

/** Weitere Punkteregeln als ganze Sätze. */
export function pointRules() {
  return [
    'Nur der erste Versuch pro Wort in einer Runde gibt Punkte. Falsche Wörter kosten nie Punkte, sie kommen in der Runde nur nochmal.',
    `Neue Wörter und Wörter, die heute dran sind, geben volle Punkte. Wörter, die du erst vor kurzem geübt hast, geben nur ${pct(SCORE.earlyShare)} (mindestens 1 Punkt). Üben lohnt sich am meisten, wenn die App dir das Wort zeigt.`,
    `Serie: Jede ${SCORE.runLength}. richtige Antwort in Folge gibt +${SCORE.runBonus} (beim Auswählen und Tippen).`,
    `Wiederholung: Ein Wort aus Box ${SCORE.reviewMinBox} oder höher richtig zu haben gibt +${SCORE.reviewBonus}.`,
    `Perfekte Runde: Alle Wörter beim ersten Mal richtig gibt +${SCORE.perfectBonus} (ab ${SCORE.perfectMinWords} Wörtern, und mindestens die Hälfte davon muss neu oder fällig gewesen sein). Bei Karteikarten gibt es diesen Bonus nicht.`,
    `Tagesziel: Die ersten ${SCORE.dailyFull} Punkte pro Tag zählen voll, danach zählen weitere Punkte nur zur Hälfte.`,
  ];
}

export function streakRules() {
  return [
    'Ein Tag zählt, sobald du mindestens eine Runde fertig gespielt hast.',
    `Verpasst du einen einzelnen Tag, bleibt deine Serie erhalten. Das klappt höchstens einmal in ${SKIP_WINDOW_DAYS} Tagen. Zwei verpasste Tage in Folge beenden die Serie.`,
  ];
}

/** Level: [Level, Titel, ab Punkten] */
export function levelRows() {
  return LEVELS.map((l) => [l.level, l.title, l.from]);
}

const WHEN = { 0: 'gleich wieder', 1: 'morgen wieder' };

/** Wiederholungsplan: [Box, wann wieder] */
export function boxRows() {
  const rows = [];
  for (let box = 1; box <= MAX_BOX; box += 1) {
    const d = INTERVAL_DAYS[box];
    rows.push([box, WHEN[d] ?? `nach ${d} Tagen wieder`]);
  }
  return rows;
}

export function prepRules() {
  return [
    'Wähle die Lernziele, die im Test dran kommen. Die App zeigt dir, wie bereit du schon bist.',
    `«Üben bis es sitzt»: Du übst die schwächsten Wörter. Ein Wort in einer Richtung sitzt, wenn du es ${SURE_STREAK}-mal hintereinander richtig hattest oder es im Wiederholungsplan schon in Box ${SURE_BOX} steht. Jedes Wort muss in beiden Richtungen sitzen.`,
    '«Probe-Test»: Jedes Wort kommt einmal dran, du tippst die Antwort, und es gibt keine Hinweise. Am Ende bekommst du eine Note (6 = alles richtig). Für den Probe-Test gibt es keine Punkte.',
  ];
}
