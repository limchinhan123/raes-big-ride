// Generic, configurable word matcher. Vocabulary and aliases belong to callers.

export function normalize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

function phon(w) {
  return w.toLowerCase().replace(/[^a-z]/g, '')
    .replace(/ph/g, 'f')
    .replace(/[ckq]/g, 'k')
    .replace(/[sz]/g, 's')
    .replace(/(.)\1+/g, '$1')
    .replace(/[aeiou]/g, '')
    .slice(0, 8);
}

// Returns a matcher for target arrays shaped as { id, say[] }. Aliases are a
// normalized-target-to-alternatives map, intentionally supplied by the caller.
export function createMatcher({ aliases = {} } = {}) {
  return function matchWord(heard, targets) {
    const text = normalize(heard);
    if (!text) return null;
    const tokens = text.split(' ');
    const grams = [...new Set([...tokens, text])];

    const cand = targets.map((target) => {
      const words = new Set();
      for (const w of target.say) {
        const nw = normalize(w);
        if (nw) words.add(nw);
        for (const a of aliases[nw] ?? []) { const na = normalize(a); if (na) words.add(na); }
      }
      return { id: target.id, words: [...words] };
    });

    // Tier by quality: exact → contains → prefix → edit-distance → phonetic.
    for (let qi = 0; qi < 5; qi++) {
      for (const t of cand) {
        for (const w of t.words) {
          for (const g of grams) {
            if (qi === 0 && g === w) return { id: t.id, quality: 1 };
            if (qi === 1 && w.length > 2 && (g.includes(w) || w.includes(g)) && g.length >= 2)
              return { id: t.id, quality: 0.9 };
            if (qi === 2 && w.length >= 4 && g.length >= 3 &&
                (g.startsWith(w.slice(0, 3)) || w.startsWith(g.slice(0, 3))))
              return { id: t.id, quality: 0.8 };
            if (qi === 3) {
              const tol = w.length <= 3 ? 1 : (w.length <= 6 ? 2 : 3);
              if (lev(g, w) <= tol) return { id: t.id, quality: 0.7 };
            }
            if (qi === 4) {
              const pw = phon(w), pg = phon(g);
              if (pw.length >= 2 && pg.length >= 1 && lev(pg, pw) <= (pw.length <= 3 ? 1 : 2))
                return { id: t.id, quality: 0.6 };
            }
          }
        }
      }
    }
    return null;
  };
}
