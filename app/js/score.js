// Spielregeln: Punkte, Level und Tages-Serie (Streak). Kein DOM-Zugriff.
// Alle Zahlen stehen oben als Konstanten, damit sie leicht angepasst werden können.
// Regeln v1 freigegeben am 2026-11-13, verschärft (v2) und freigegeben am 2026-11-14.
// Die Anleitung in der App (helpView) liest diese Konstanten, damit Text und Regeln übereinstimmen.

export const SCORE = Object.freeze({
  choice: 10,          // Auswählen, richtig
  type: 20,            // Tippen, richtig
  near: 10,            // Tippen, nur Akzent/Umlaut falsch
  cards: 5,            // Karteikarten, «Gewusst» (Selbsteinschätzung, darum weniger wert; keine Boni)
  earlyShare: 0.2,     // Wort, das heute nicht dran ist (nicht neu, nicht fällig): Anteil der Punkte
  runLength: 5,        // so viele richtige in Folge geben einen Bonus
  runBonus: 5,
  perfectBonus: 20,    // ganze Runde ohne Fehler beim ersten Versuch
  perfectMinWords: 5,  // erst ab so vielen Wörtern in der Runde
  perfectMinDueShare: 0.5, // und wenn mindestens so viele davon neu oder fällig waren
  reviewBonus: 5,      // Wort aus hoher Box richtig (Altes behalten)
  reviewMinBox: 3,
  dailyFull: 200,      // so viele Punkte pro Tag gibt es voll
  dailyOverShare: 0.5, // danach zählen weitere Punkte nur zu diesem Anteil
});

/** Höchstens ein verpasster Tag pro so vielen Tagen kostet die Serie nichts. */
export const SKIP_WINDOW_DAYS = 7;

/** Level: ab so vielen Punkten wird das Level erreicht. */
export const LEVELS = Object.freeze([
  { level: 1, title: 'Fuchsjunges', from: 0 },
  { level: 2, title: 'Neugieriger Fuchs', from: 150 },
  { level: 3, title: 'Schlauer Fuchs', from: 500 },
  { level: 4, title: 'Wortjäger', from: 1200 },
  { level: 5, title: 'Vokabel-Profi', from: 2500 },
  { level: 6, title: 'Wortmeister', from: 4500 },
  { level: 7, title: 'Sprachfuchs', from: 7500 },
  { level: 8, title: 'Grand Renard', from: 12000 },
  { level: 9, title: 'Maître des Mots', from: 18000 },
  { level: 10, title: 'Légende', from: 26000 },
]);
/** Über dem letzten Level kommt alle so viele Punkte eine weitere Stufe dazu. */
export const BEYOND_STEP = 10000;

const DAY = 86400000;

// ---------- Punkte in einer Runde ----------

export function createRound() {
  return { points: 0, run: 0, answered: 0, eligible: 0 };
}

/** Punkte bis zum Tageslimit voll, darüber nur zum Anteil dailyOverShare. */
export function applyDailyCap(raw, todayPts) {
  const room = Math.max(0, SCORE.dailyFull - todayPts);
  if (raw <= room) return { gained: raw, halved: false };
  return { gained: room + Math.ceil((raw - room) * SCORE.dailyOverShare), halved: true };
}

/**
 * Verbucht eine Antwort. Nur der erste Versuch pro Wort gibt Punkte und zählt für die Serie.
 * Gibt { round, gained, base, review, runBonus, halved } zurück (neuer Zustand, alter bleibt unverändert).
 *  result: 'correct' | 'accent' | 'wrong'
 *  mode: 'choice' | 'type' | 'cards'
 *  boxBefore: Box des Wortes vor der Antwort (0 = neu)
 *  eligible: Wort war neu oder fällig (sonst nur earlyShare der Punkte, keine Boni, keine Serie)
 *  todayPoints: bereits heute erzielte Punkte (für das Tageslimit)
 */
export function scoreAnswer(round, { mode, result, boxBefore = 0, firstTry, eligible = true, todayPoints = 0 }) {
  const none = { round, gained: 0, base: 0, review: 0, runBonus: 0, halved: false };
  if (!firstTry) return none;

  const counted = { answered: round.answered + 1, eligible: round.eligible + (eligible ? 1 : 0) };
  if (result === 'wrong') {
    return { ...none, round: { ...round, ...counted, run: mode === 'cards' ? round.run : 0 } };
  }

  const full = result === 'accent' ? SCORE.near
    : mode === 'type' ? SCORE.type
      : mode === 'cards' ? SCORE.cards
        : SCORE.choice;

  let base = full;
  let review = 0;
  let runBonus = 0;
  let run = round.run;
  if (!eligible) {
    base = Math.max(1, Math.round(full * SCORE.earlyShare));
  } else if (mode !== 'cards') {
    review = result === 'correct' && boxBefore >= SCORE.reviewMinBox ? SCORE.reviewBonus : 0;
    run = round.run + 1;
    runBonus = run % SCORE.runLength === 0 ? SCORE.runBonus : 0;
  }

  const { gained, halved } = applyDailyCap(base + review + runBonus, todayPoints);
  return { round: { ...round, ...counted, points: round.points + gained, run }, gained, base, review, runBonus, halved };
}

/**
 * Bonus am Rundenende (vor dem Tageslimit).
 * eligible = Anzahl Wörter der Runde, die neu oder fällig waren.
 */
export function perfectBonus({ total, wrongCount, mode, eligible = total }) {
  if (mode === 'cards') return 0;
  if (wrongCount !== 0 || total < SCORE.perfectMinWords) return 0;
  return eligible / total >= SCORE.perfectMinDueShare ? SCORE.perfectBonus : 0;
}

// ---------- Tagespunkte ----------

/** Punkte, die heute schon erzielt wurden. daily = { day, points } */
export function todayPoints(daily, now = Date.now()) {
  return daily && daily.day === dayKey(now) ? daily.points : 0;
}

export function addToday(daily, gained, now = Date.now()) {
  const day = dayKey(now);
  return daily && daily.day === day
    ? { day, points: daily.points + gained }
    : { day, points: gained };
}

// ---------- Level ----------

/** Punkte, die für Level n insgesamt nötig sind. */
export function levelThreshold(n) {
  if (n <= 1) return 0;
  if (n <= LEVELS.length) return LEVELS[n - 1].from;
  return LEVELS[LEVELS.length - 1].from + BEYOND_STEP * (n - LEVELS.length);
}

export function levelFor(points) {
  let n = 1;
  while (points >= levelThreshold(n + 1)) n += 1;
  return n;
}

export function levelTitle(n) {
  return LEVELS[Math.min(Math.max(n, 1), LEVELS.length) - 1].title;
}

export function levelInfo(points) {
  const level = levelFor(points);
  const floor = levelThreshold(level);
  const next = levelThreshold(level + 1);
  return {
    level,
    title: levelTitle(level),
    points,
    floor,
    next,
    toNext: next - points,
    fraction: (points - floor) / (next - floor),
  };
}

/**
 * Level nach den Regeln v1 (Schwellen 100, 300, 600, 1000, dann +500).
 * Wird nur gebraucht, um den Stand aus der alten Version zu übernehmen.
 */
export function legacyLevelFor(points) {
  const threshold = (n) => (n <= 1 ? 0 : n <= 5 ? 50 * n * (n - 1) : 1000 + 500 * (n - 5));
  let n = 1;
  while (points >= threshold(n + 1)) n += 1;
  return n;
}

// ---------- Tages-Serie ----------

const pad = (n) => String(n).padStart(2, '0');

/** Lokaler Kalendertag als 'JJJJ-MM-TT'. */
export function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayIndex(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
}

/** Tage von heute bis zum Tag `key` (negativ = vorbei). */
export function daysUntil(key, now = Date.now()) {
  return dayIndex(key) - dayIndex(dayKey(now));
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** 'Fr 20.11.' für 'JJJJ-MM-TT'. */
export function formatDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${wd} ${d}.${m}.`;
}

/** Merkt sich, dass an diesem Tag geübt wurde (eine abgeschlossene Runde genügt). */
export function recordDay(days, now = Date.now()) {
  const key = dayKey(now);
  const set = new Set(days);
  set.add(key);
  return [...set].sort().slice(-120);
}

/**
 * Länge der Serie. Gezählt werden Tage mit Übung. Ein einzelner verpasster Tag
 * unterbricht die Serie nicht, solange davor mindestens SKIP_WINDOW_DAYS Tage
 * kein verpasster Tag verziehen wurde. Zwei verpasste Tage in Folge beenden sie.
 * Wer heute noch nicht geübt hat, behält die Serie von gestern.
 */
export function streakFor(days, now = Date.now()) {
  const active = new Set(days.map(dayIndex));
  const today = dayIndex(dayKey(now));
  let d = active.has(today) ? today : today - 1;
  let streak = 0;
  let lastSkip = null;
  for (;;) {
    if (active.has(d)) {
      streak += 1;
      d -= 1;
    } else if (active.has(d - 1) && (lastSkip === null || lastSkip - d >= SKIP_WINDOW_DAYS)) {
      lastSkip = d;
      d -= 1;
    } else {
      return streak;
    }
  }
}
