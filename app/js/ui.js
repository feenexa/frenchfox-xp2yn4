// Kleine Hilfsfunktion zum Bauen von DOM-Elementen (kein Framework).

/**
 * h('button', { class: 'btn', onClick: fn, 'aria-label': 'x' }, 'Text', andereElemente)
 * Texte werden als Text eingefügt (nie als HTML).
 */
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k.startsWith('aria-') && typeof v === 'boolean') { el.setAttribute(k, String(v)); continue; }
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export function progressBar(fraction, label) {
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  const fill = h('span');
  fill.style.width = `${pct}%`;
  return h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': label }, fill);
}

/** Das Logo als dekoratives Bild. Die Grösse folgt der Schriftgrösse des Elternelements (siehe «.fox img» im CSS). */
export function mascot() {
  const img = document.createElement('img');
  img.src = 'icons/logo.png';
  img.alt = '';
  img.decoding = 'async';
  // Rückfall, falls das Bild fehlt: das Fuchs-Emoji
  img.addEventListener('error', () => img.replaceWith(document.createTextNode('🦊')));
  return img;
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}
