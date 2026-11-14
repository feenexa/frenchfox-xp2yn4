// Vorlesen französischer Wörter mit der Sprachausgabe des Browsers.
// Funktioniert auch über http im Heimnetz (anders als die Spracherkennung).

export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let cachedVoice;

function pickVoice() {
  if (cachedVoice) return cachedVoice;
  const fr = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('fr'));
  cachedVoice = fr.find((v) => v.lang.replace('_', '-') === 'fr-FR') ?? fr[0] ?? null;
  return cachedVoice;
}

if (canSpeak) {
  // Die Stimmenliste ist anfangs oft leer und füllt sich später.
  speechSynthesis.addEventListener?.('voiceschanged', () => { cachedVoice = undefined; });
}

/** Liest Text auf Französisch vor. Muss aus einem Tippen/Klick heraus aufgerufen werden (iOS). */
export function speakFr(text, rate = 0.85) {
  if (!canSpeak || !text) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = rate;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    // Vorlesen ist ein Zusatz, Fehler dürfen die App nicht stören.
  }
}

export function stopSpeaking() {
  if (canSpeak) speechSynthesis.cancel();
}

/** Text, der für einen Eintrag vorgelesen wird (bei Adjektiven männlich und weiblich). */
export function speakText(item) {
  return item.type === 'adj' ? item.frForms.join(', ') : item.frForms[0];
}
