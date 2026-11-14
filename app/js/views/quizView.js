// Übungsrunde: eine Frage pro Bildschirm. Antwort durch Auswählen, Tippen oder Karteikarte.
// Falsche Wörter («Nochmal» bei Karteikarten) kommen in der Runde noch bis zu zweimal wieder.
// Auch für die Testvorbereitung: «practice» (Üben bis es sitzt, Richtung je Wort) und
// «probe» (Probe-Test: getippt, ohne Rückmeldung, mit Note am Ende).

import { h, progressBar, pick, mascot } from '../ui.js';
import { makeChoices, checkAnswer, acceptedAnswers, questionText, solutionText, answerLang } from '../quiz.js';
import { review, keyOf, needsPractice } from '../srs.js';
import {
  SCORE, createRound, scoreAnswer, perfectBonus, applyDailyCap, todayPoints, addToday,
  levelInfo, recordDay, streakFor, dayKey,
} from '../score.js';
import { updateStreak, probePoints, swissGrade } from '../prep.js';
import { speakFr, speakText, stopSpeaking, canSpeak } from '../speech.js';

const MAX_REQUEUES = 2;
const PRAISE = ['Richtig!', 'Super!', 'Genau!', 'Top!', 'Stark!', 'Bravo!'];
const ENCOURAGE = ['Nicht schlimm!', 'Fast!', 'Das merkst du dir bald!', 'Kein Problem!'];

/**
 * params: {
 *   items: Wörter dieser Runde,
 *   direction: 'de-fr' | 'fr-de' (Standard für alle Wörter),
 *   dirs: optional { [wortId]: Richtung } (überschreibt direction je Wort),
 *   mode: 'choice' | 'type' | 'cards',
 *   test: optional 'practice' | 'probe'
 * }
 * Gibt eine Aufräumfunktion zurück (entfernt Tastaturbelegung und Listener).
 */
export function renderQuiz(root, ctx, { items, direction = 'de-fr', dirs = null, mode = 'choice', test = null }) {
  const { store, allItems, show } = ctx;
  const probe = test === 'probe';
  const practice = test === 'practice';
  const sound = () => store.get().settings.sound;
  const dirOf = (it) => dirs?.[it.id] ?? direction;

  if (!items.length) {
    show('home');
    return undefined;
  }

  const total = items.length;
  const queue = [...items];
  const requeues = new Map();
  const firstTry = new Map(); // id → beim ersten Versuch nicht falsch?
  const probeScores = new Map(); // id → 0, 0.5 oder 1 (nur Probe-Test)
  let done = 0;
  let current;
  let answered = false;
  let keyHandler = null;
  let round = createRound();
  let pendingGain = ''; // Punkte der letzten Karteikarte, werden auf der nächsten Karte eingeblendet
  const startPoints = store.get().points;

  const ac = new AbortController();
  document.addEventListener('keydown', (e) => keyHandler?.(e), { signal: ac.signal });

  function finish() {
    const wrong = items.filter((it) => firstTry.get(it.id) === false);
    const now = Date.now();

    if (probe) {
      const points = [...probeScores.values()].reduce((a, b) => a + b, 0);
      const grade = swissGrade(points, total);
      store.update((d) => ({
        ...d,
        days: recordDay(d.days, now),
        prep: { ...d.prep, lastProbe: { day: dayKey(now), grade, points, max: total } },
      }));
      show('probe', {
        total,
        points,
        grade,
        rows: items.map((it) => ({ item: it, dir: dirOf(it), score: probeScores.get(it.id) ?? 0 })),
      });
      return;
    }

    const rawBonus = perfectBonus({ total, wrongCount: wrong.length, mode, eligible: round.eligible });
    const bonus = applyDailyCap(rawBonus, todayPoints(store.get().daily, now));
    // Punkte der einzelnen Antworten sind schon gespeichert. Jetzt Rundenbonus und Übungstag.
    store.update((d) => ({
      ...d,
      points: d.points + bonus.gained,
      daily: addToday(d.daily, bonus.gained, now),
      days: recordDay(d.days, now),
    }));
    const data = store.get();
    show('result', {
      total,
      right: total - wrong.length,
      wrong,
      direction,
      dirs,
      mode,
      test,
      gained: round.points + bonus.gained,
      perfectBonus: rawBonus > 0 ? bonus.gained : 0,
      streak: streakFor(data.days, now),
      levelBefore: levelInfo(startPoints),
      levelAfter: levelInfo(data.points),
      dailyDone: todayPoints(data.daily, now) >= SCORE.dailyFull,
      lowShare: round.answered > 0 && round.eligible / round.answered < SCORE.perfectMinDueShare,
    });
  }

  function showQuestion() {
    current = queue[0];
    answered = false;
    const dir = dirOf(current);
    const lang = answerLang(dir);

    const progress = progressBar(done / total, 'Fortschritt in dieser Runde');
    const fill = progress.firstChild;
    const counter = h('div', { class: 'counter' }, `${done} / ${total}`);
    const pointsNum = h('span', {}, String(round.points));
    const gainEl = h('span', { class: pendingGain ? 'gain pop' : 'gain', 'aria-hidden': 'true' }, pendingGain);
    pendingGain = '';
    const pointsChip = h('div', { class: 'points', 'aria-label': 'Punkte dieser Runde' }, '⭐ ', pointsNum, gainEl);
    const fox = h('div', { class: 'fox', 'aria-hidden': 'true' }, mascot());
    const feedback = h('p', { class: 'feedback', role: 'status' });
    const nextBtn = h('button', {
      class: 'btn btn-primary',
      hidden: true,
      onClick: () => (queue.length === 0 ? finish() : showQuestion()),
    }, 'Weiter');

    const speakBtn = canSpeak && h('button', {
      class: 'icon-btn',
      'aria-label': 'Wort anhören',
      onClick: () => speakFr(speakText(current)),
    }, '🔊');
    const speakRow = h('div', { class: 'speak-row' }, speakBtn);
    // Bei Deutsch → Französisch verrät Vorlesen die Lösung, darum erst nach der Antwort.
    // Der Platz bleibt reserviert, damit nichts springt.
    if (dir === 'de-fr') speakRow.style.visibility = 'hidden';

    let area;

    /** Verbucht das Ergebnis: 'correct' | 'accent' | 'wrong'. */
    function settle(result, matched, reason) {
      if (answered) return;
      answered = true;
      const now = Date.now();
      const key = keyOf(current.id, dir);
      const entry = store.get().srs[key];
      const isFirst = !firstTry.has(current.id);

      let sc = { gained: 0, runBonus: 0, halved: false };
      if (!probe) {
        sc = scoreAnswer(round, {
          mode,
          result,
          boxBefore: entry?.seen > 0 ? entry.box : 0,
          firstTry: isFirst,
          eligible: needsPractice(entry, now),
          todayPoints: todayPoints(store.get().daily, now),
        });
        round = sc.round;
      }
      store.update((d) => {
        const next = {
          ...d,
          srs: review(d.srs, key, result, now),
          points: d.points + sc.gained,
          daily: addToday(d.daily, sc.gained, now),
        };
        if (practice) next.prep = { ...d.prep, streak: updateStreak(d.prep.streak, key, result !== 'wrong') };
        return next;
      });
      if (isFirst) {
        firstTry.set(current.id, result !== 'wrong');
        if (probe) probeScores.set(current.id, probePoints(result));
      }
      pointsNum.textContent = String(round.points);
      const gainText = sc.gained > 0 ? `+${sc.gained}${sc.runBonus ? ' 🔥' : ''}${sc.halved ? ' ½' : ''}` : '';
      if (gainText) {
        gainEl.textContent = gainText;
        gainEl.classList.add('pop');
      }

      queue.shift();
      if (result === 'wrong' && !probe) {
        const n = requeues.get(current.id) ?? 0;
        if (n < MAX_REQUEUES) {
          requeues.set(current.id, n + 1);
          queue.push(current);
        } else {
          done += 1;
        }
      } else {
        done += 1;
      }

      if (area.autoAdvance) {
        // Karteikarten und Probe-Test: sofort weiter (im selben Tipp, damit iOS das Vorlesen erlaubt).
        pendingGain = gainText;
        if (queue.length === 0) finish();
        else showQuestion();
        return;
      }

      const solution = solutionText(current, dir);
      if (result === 'correct') {
        feedback.className = 'feedback is-ok';
        feedback.textContent = `${pick(PRAISE)} ${solution}`;
      } else if (result === 'accent') {
        feedback.className = 'feedback is-near';
        feedback.textContent = reason === 'article'
          ? `Fast richtig! Vergiss den Artikel nicht: ${matched ?? solution}`
          : `Fast richtig! Achte auf die Zeichen: ${matched ?? solution}`;
      } else {
        feedback.className = 'feedback is-bad';
        feedback.textContent = `${pick(ENCOURAGE)} Richtig ist: ${solution}`;
      }
      fox.classList.add(result === 'wrong' ? 'is-sad' : 'is-happy');
      fill.style.width = `${Math.round((done / total) * 100)}%`;
      counter.textContent = `${done} / ${total}`;
      speakRow.style.visibility = 'visible';

      area.afterAnswer(result, matched, reason);
      nextBtn.textContent = queue.length === 0 ? 'Fertig' : 'Weiter';
      nextBtn.hidden = false;
      nextBtn.focus({ preventScroll: true });
      if (dir === 'de-fr' && sound()) speakFr(speakText(current));
    }

    // ---- Auswählen ----
    function choiceArea() {
      const choices = makeChoices(current, allItems, dir);
      let chosen = -1;
      const buttons = choices.options.map((opt, i) =>
        h('button', {
          class: 'option',
          onClick: () => {
            if (answered) return;
            chosen = i;
            settle(opt.correct ? 'correct' : 'wrong');
          },
        },
        h('span', { class: 'key', 'aria-hidden': 'true' }, String(i + 1)),
        h('span', { class: 'text', lang: lang === 'fr' ? 'fr' : 'de' }, opt.text),
        h('span', { class: 'mark', 'aria-hidden': 'true' })));
      return {
        nodes: buttons,
        afterAnswer() {
          buttons.forEach((btn, i) => {
            btn.disabled = true;
            if (choices.options[i].correct) {
              btn.classList.add('is-correct');
              btn.querySelector('.mark').textContent = '✔';
            } else if (i === chosen) {
              btn.classList.add('is-wrong');
              btn.querySelector('.mark').textContent = '✘';
            } else {
              btn.classList.add('is-dim');
            }
          });
        },
        onKey(e) {
          if (/^[1-4]$/.test(e.key) && buttons[Number(e.key) - 1]) {
            e.preventDefault();
            buttons[Number(e.key) - 1].click();
          }
        },
      };
    }

    // ---- Tippen ----
    function typeArea() {
      const accepted = acceptedAnswers(current, dir);
      const input = h('input', {
        class: 'type-input',
        type: 'text',
        autocomplete: 'off',
        autocapitalize: 'off',
        autocorrect: 'off',
        spellcheck: 'false',
        enterkeyhint: probe ? 'next' : 'done',
        lang,
        'aria-label': 'Deine Antwort',
        placeholder: lang === 'fr' ? 'Auf Französisch schreiben …' : 'Auf Deutsch schreiben …',
      });

      const submit = () => {
        if (answered) return;
        // Bei Nomen gilt eine Antwort ohne Artikel als «Fast richtig».
        const r = checkAnswer(input.value, accepted, lang, { articles: current.type === 'word' });
        if (r.result === 'empty') {
          feedback.className = 'feedback is-bad';
          feedback.textContent = 'Schreib zuerst etwas, oder tippe auf «Weiss ich nicht».';
          input.focus();
          return;
        }
        settle(r.result, r.matched, r.reason);
      };

      input.addEventListener('keydown', (e) => {
        e.stopPropagation(); // sonst löst dasselbe Enter gleich «Weiter» aus
        if (e.key === 'Enter') {
          e.preventDefault();
          submit();
        }
      });

      // Akzente und Umlaute schreibt man mit der Tastatur des Geräts (Schweizer Tastatur), keine Extra-Tasten.
      const checkBtn = h('button', { class: 'btn btn-primary', onClick: submit }, probe ? 'Weiter' : 'Prüfen');
      const idkBtn = h('button', { class: 'btn', onClick: () => settle('wrong') }, 'Weiss ich nicht');
      // Die Lösung steht direkt unter dem Feld, dort wo man hinschaut (nicht nur oben links
      // und nicht nur gesprochen). Bei Fehlern und fehlenden Akzenten gross und deutlich.
      const solutionBox = h('div', { class: 'solution', hidden: true, role: 'status' });
      const hint = current.de.length > 1 && dir === 'fr-de'
        ? h('p', { class: 'hint' }, 'Eine Bedeutung reicht.')
        : null;

      const scrollIntoView = () => checkBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      input.addEventListener('focus', () => setTimeout(scrollIntoView, 300));
      window.visualViewport?.addEventListener('resize', scrollIntoView, { signal: ac.signal });

      return {
        autoAdvance: probe, // Probe-Test: keine Rückmeldung, gleich die nächste Frage
        nodes: [
          input,
          solutionBox,
          h('div', { class: 'type-actions' }, idkBtn, checkBtn),
          hint,
        ],
        focus: () => input.focus({ preventScroll: true }),
        afterAnswer(result, matched, reason) {
          input.readOnly = true;
          input.blur(); // Tastatur zu, damit nichts verdeckt wird
          input.placeholder = '';
          input.classList.add(result === 'correct' ? 'is-correct' : result === 'accent' ? 'is-near' : 'is-wrong');
          [checkBtn, idkBtn].forEach((b) => { b.disabled = true; });
          if (result !== 'correct') {
            solutionBox.className = `solution ${result === 'accent' ? 'is-near' : 'is-bad'}`;
            solutionBox.replaceChildren(
              h('span', { class: 'solution-label' }, result !== 'accent' ? 'Richtig ist:' : reason === 'article' ? 'Mit Artikel:' : 'So schreibt man es:'),
              h('span', { class: 'solution-text', lang: lang === 'fr' ? 'fr' : 'de' }, result === 'accent' ? (matched ?? solutionText(current, dir)) : solutionText(current, dir)),
            );
            solutionBox.hidden = false;
          }
        },
      };
    }

    // ---- Karteikarten ----
    function cardArea() {
      let flipped = false;
      const question = questionText(current, dir);
      const solution = solutionText(current, dir);

      const speakBack = canSpeak && h('button', {
        class: 'icon-btn',
        'aria-label': 'Wort anhören',
        onClick: (e) => { e.stopPropagation(); speakFr(speakText(current)); },
      }, '🔊');
      const front = h('div', { class: 'face face-front' },
        h('div', { class: 'q-label' }, dir === 'de-fr' ? 'Auf Französisch?' : 'Auf Deutsch?'),
        h('div', { class: 'q-text', lang: dir === 'de-fr' ? 'de' : 'fr' }, question),
        h('div', { class: 'hint' }, 'Tippe auf die Karte, um sie umzudrehen'));
      const back = h('div', { class: 'face face-back', 'aria-hidden': 'true' },
        h('div', { class: 'back-question', lang: dir === 'de-fr' ? 'de' : 'fr' }, question),
        h('hr'),
        h('div', { class: 'q-text', lang }, solution),
        speakBack);
      const card = h('div', { class: 'flashcard', role: 'button', tabindex: '0', 'aria-label': 'Karte umdrehen' },
        h('div', { class: 'flashcard-inner' }, front, back));

      const flipBtn = h('button', { class: 'btn btn-primary', onClick: () => flip() }, 'Umdrehen');
      const againBtn = h('button', { class: 'btn', hidden: true, onClick: () => rate('wrong') }, '✘ Nochmal');
      const knownBtn = h('button', { class: 'btn btn-primary', hidden: true, onClick: () => rate('correct') }, '✔ Gewusst');
      const actions = h('div', { class: 'card-actions' }, flipBtn, againBtn, knownBtn);
      const tip = h('p', { class: 'hint' }, 'Wischen geht auch: nach rechts «Gewusst», nach links «Nochmal».');
      tip.hidden = true;

      function flip() {
        if (flipped || answered) return;
        flipped = true;
        card.classList.add('is-flipped');
        card.setAttribute('aria-label', 'Karte ist umgedreht');
        front.setAttribute('aria-hidden', 'true');
        back.removeAttribute('aria-hidden');
        flipBtn.hidden = true;
        againBtn.hidden = false;
        knownBtn.hidden = false;
        tip.hidden = false;
        if (dir === 'de-fr' && sound()) speakFr(speakText(current));
      }

      function rate(result) {
        if (!flipped || answered) return;
        settle(result);
      }

      // Tippen dreht um, Wischen bewertet (nur auf der Rückseite).
      let startX = null;
      let dx = 0;
      let moved = false;
      const reset = () => {
        startX = null;
        card.style.transform = '';
        card.classList.remove('swipe-right', 'swipe-left');
      };
      card.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button') || answered) return;
        startX = e.clientX;
        dx = 0;
        moved = false;
        card.setPointerCapture?.(e.pointerId);
      });
      card.addEventListener('pointermove', (e) => {
        if (startX === null) return;
        dx = e.clientX - startX;
        if (Math.abs(dx) > 12) moved = true;
        if (flipped && moved) {
          card.style.transform = `translateX(${dx}px) rotate(${dx / 30}deg)`;
          card.classList.toggle('swipe-right', dx > 70);
          card.classList.toggle('swipe-left', dx < -70);
        }
      });
      card.addEventListener('pointerup', () => {
        if (startX === null) return;
        const d = dx;
        const wasMoved = moved;
        reset();
        if (!wasMoved) flip();
        else if (flipped && d > 100) rate('correct');
        else if (flipped && d < -100) rate('wrong');
      });
      card.addEventListener('pointercancel', reset);

      return {
        autoAdvance: true,
        nodes: [card, actions, tip],
        afterAnswer() {},
        onKey(e) {
          if (e.key === ' ' || e.key === 'Enter') {
            if (!flipped) { e.preventDefault(); flip(); }
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            rate('correct');
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            rate('wrong');
          }
        },
      };
    }

    area = mode === 'cards' ? cardArea() : mode === 'type' ? typeArea() : choiceArea();

    const label = mode === 'type'
      ? (dir === 'de-fr' ? 'Schreib es auf Französisch:' : 'Schreib es auf Deutsch:')
      : (dir === 'de-fr' ? 'Wie heisst das auf Französisch?' : 'Was heisst das auf Deutsch?');

    const promptChildren = mode === 'cards'
      ? [fox]
      : [
        fox,
        h('div', { class: 'q-label' }, label),
        h('div', { class: 'q-text', lang: dir === 'de-fr' ? 'de' : 'fr' }, questionText(current, dir)),
        speakRow,
        feedback,
      ];

    const page = h('div', { class: `quiz mode-${mode}${probe ? ' is-probe' : ''}` },
      h('div', { class: 'quiz-top' },
        h('button', { class: 'btn', onClick: () => { stopSpeaking(); show(test ? 'prep' : 'home'); } }, '✕ Beenden'),
        progress,
        counter,
        !probe && pointsChip),
      probe && h('p', { class: 'hint probe-note' }, 'Probe-Test: Hier gibt es keine Rückmeldung. Am Ende siehst du deine Note.'),
      h('div', { class: 'quiz-grid' },
        h('section', { class: 'prompt' }, promptChildren),
        h('section', { class: 'answers' },
          area.nodes,
          !area.autoAdvance && h('div', { class: 'next-row' }, nextBtn))),
    );
    root.replaceChildren(page);

    keyHandler = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (answered) {
        if (!area.autoAdvance && e.key === 'Enter') { e.preventDefault(); nextBtn.click(); }
      } else {
        area.onKey?.(e);
      }
    };

    area.focus?.();
    // Bei Französisch → Deutsch wird die Frage vorgelesen. Läuft im selben Tipp wie «Los»/«Weiter»/Bewertung (iOS).
    if (dir === 'fr-de' && sound()) speakFr(speakText(current));
  }

  showQuestion();
  return () => { ac.abort(); stopSpeaking(); };
}
