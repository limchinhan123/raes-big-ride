// Forgiving word matching for a 4-year-old's speech through browser ASR.
// Direct hit > alias hit > small edit distance. Never punishing.

const ALIASES = {
  a: ['ay', 'eh', 'hey'],
  b: ['bee', 'be', 'bea', 'bees'],
  c: ['sea', 'see', 'si', 'seed'],
  o: ['oh', 'owe', 'zero'],
  s: ['es', 'ass', 'yes'],
  m: ['em', 'am', 'mm'],
  one: ['won', 'wan', '1'],
  two: ['to', 'too', 'tu', '2'],
  three: ['tree', 'free', 'threes', '3'],
  four: ['for', 'fore', 'foor', '4'],
  five: ['hive', 'fife', '5'],
  cat: ['cats', 'kat', 'kitty'],
  dog: ['dogs', 'doggy', 'dock'],
  bus: ['buzz', 'boss', 'busses'],
  ball: ['bore', 'bao', 'balls'],
  fish: ['fishy', 'fis', 'fishes'],
  bird: ['birds', 'bird bird', 'burt'],
  cake: ['cakes', 'cake cake', 'kek'],
  star: ['stars', 'staa', 'sta'],
  duck: ['ducks', 'duck duck', 'dark'],
  egg: ['eggs', 'egg egg', 'x'],
  stop: ['stopp', 'stob', 'star p'],
  go: ['goh', 'gogo', 'go go'],
  wheee: ['we', 'wee', 'whee', 'weee', 'yay', 'wow', 'woah'],
  moon: ['moo', 'moons'],
  sun: ['son', 'sunny'],
  tree2: ['tree'],
  flower: ['flowers', 'flour', 'fella'],
  boat: ['boats', 'bot', 'both'],
  crab: ['crabs', 'grab'],
  shell: ['shells', 'shall'],
  kite: ['kites', 'kai', 'kind'],
  car: ['cars', 'kar'],
  bell: ['bells', 'bail', 'bao'],
  'ring ring': ['ring', 'ring ring ring', 'ling ling'],
  // NB: aliases here trigger always-on steering, so no everyday narration words
  // ('let', 'light', 'ride', 'girl') — those caused phantom steers/greens.
  left: ['lef', 'lift', 'laft', 'left left', 'lept'],
  right: ['rite', 'write', 'right right', 'wight'],
  faster: ['fast', 'faster faster', 'fasta', 'vaster', 'fassa'],
  slower: ['slow', 'slower slower', 'sloa', 'slowa', 'lower'],
  // common toddler renderings of the wider vocabulary
  apple: ['appo', 'appu', 'abble', 'apo'],
  banana: ['nana', 'nanana', 'banan', 'panana'],
  rabbit: ['wabbit', 'wabbi', 'rabbi'],
  frog: ['fog', 'fwog', 'frag'],
  elephant: ['ephant', 'elphant', 'ellie', 'efelant'],
  butterfly: ['butfly', 'buttfly', 'flutterby', 'butterfy'],
  strawberry: ['strawbee', 'strabby', 'sawberry'],
  pineapple: ['pineappo', 'pine', 'appo'],
  watermelon: ['watamelon', 'melon', 'wawa'],
  triangle: ['trangle', 'tri', 'triangoo'],
  circle: ['circoo', 'sircle', 'circ'],
  square: ['squares', 'sqway', 'skware'],
  flower: ['flowa', 'fowa', 'flowers'],
  yellow: ['yellow yellow', 'lello', 'yeyo'],
  monkey: ['monkeys', 'munky', 'monki'],
  snail: ['snails', 'nail', 'snai'],
  turtle: ['tuttle', 'tuɾtle', 'turto'],
  penguin: ['pengin', 'pengu', 'pingu'],
  umbrella: ['brella', 'umbella', 'umbwella'],
  pumpkin: ['punkin', 'pumkin', 'pumpki'],
  mushroom: ['mushoom', 'moom', 'mushy'],
  carrot: ['cawwot', 'carot', 'cawot'],
  balloon: ['baloon', ' balloo', 'bayoon'],
  train: ['choo choo', 'chtrain', 'twain'],
  plane: ['aeroplane', 'airplane', 'pane', 'pwane'],
};

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

// A consonant-ish skeleton so a toddler's rough sounds still land:
// "wabbit"→"wbt" ~ "rabbit"→"rbt", "gog"→"gg" ~ "dog"→"dg", "appo"~"apple".
function phon(w) {
  return w.toLowerCase().replace(/[^a-z]/g, '')
    .replace(/ph/g, 'f')
    .replace(/[ckq]/g, 'k')
    .replace(/[sz]/g, 's')
    .replace(/(.)\1+/g, '$1')   // collapse doubles
    .replace(/[aeiou]/g, '')    // drop vowels
    .slice(0, 8);
}

// heard: raw ASR text. targets: array of {id, say[]}. Returns {id, quality}
// or null. Deliberately forgiving — for a pre-reader, a near-miss should
// count, and every "yes" outcome here is safe (dodge / valid path / stop).
export function matchWord(heard, targets) {
  const text = normalize(heard);
  if (!text) return null;
  const tokens = text.split(' ');
  const grams = [...new Set([...tokens, text])];

  // Build the full candidate set per target once (word + aliases).
  const cand = targets.map((target) => {
    const words = new Set();
    for (const w of target.say) {
      const nw = normalize(w);
      if (nw) words.add(nw);
      for (const a of ALIASES[nw] ?? []) { const na = normalize(a); if (na) words.add(na); }
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
}
