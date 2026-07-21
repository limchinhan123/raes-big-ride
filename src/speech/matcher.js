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
  go: ['goh', 'gogo', 'goal', 'girl'],
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
  left: ['lef', 'lift', 'let', 'laft', 'left left'],
  right: ['rite', 'write', 'bright', 'right right', 'ride'],
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

// heard: raw ASR text. targets: array of {id, say[]} where say includes the
// primary word plus hint words. Returns {id, quality} or null.
export function matchWord(heard, targets) {
  const text = normalize(heard);
  if (!text) return null;
  const tokens = text.split(' ');
  const grams = [...tokens, text];
  for (let qi = 0; qi < 3; qi++) {
    for (const target of targets) {
      const words = [];
      for (const w of target.say) {
        const nw = normalize(w);
        words.push(nw);
        if (ALIASES[nw]) words.push(...ALIASES[nw]);
      }
      for (const w of words) {
        for (const g of grams) {
          if (qi === 0 && g === w) return { id: target.id, quality: 1 };
          if (qi === 1 && w.length > 3 && g.includes(w)) return { id: target.id, quality: 0.9 };
          if (qi === 2) {
            const tol = w.length <= 3 ? 1 : 2;
            if (lev(g, w) <= tol) return { id: target.id, quality: 0.7 };
          }
        }
      }
    }
  }
  return null;
}
