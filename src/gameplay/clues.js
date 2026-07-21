// The curriculum. One big, deliberately varied pool — animals, fruit, veg,
// shapes, numbers, letters, everyday things — dealt as a no-repeat deck so a
// ride never turns into "count to five" over and over. Each chapter leans
// gently toward a theme but always mixes categories.

const P = (id, label, glyph, say, cat, hint) => ({ id, label, glyph, say, cat, hint });

export const POOL = [
  // ---- animals
  P('cat', 'CAT', '🐱', ['cat'], 'animal'),
  P('dog', 'DOG', '🐶', ['dog'], 'animal'),
  P('bird', 'BIRD', '🐦', ['bird'], 'animal'),
  P('duck', 'DUCK', '🦆', ['duck'], 'animal'),
  P('fish', 'FISH', '🐟', ['fish'], 'animal'),
  P('cow', 'COW', '🐮', ['cow'], 'animal'),
  P('pig', 'PIG', '🐷', ['pig'], 'animal'),
  P('frog', 'FROG', '🐸', ['frog'], 'animal'),
  P('bee', 'BEE', '🐝', ['bee'], 'animal'),
  P('butterfly', 'BUTTERFLY', '🦋', ['butterfly'], 'animal'),
  P('snail', 'SNAIL', '🐌', ['snail'], 'animal'),
  P('crab', 'CRAB', '🦀', ['crab'], 'animal'),
  P('otter', 'OTTER', '🦦', ['otter'], 'animal'),
  P('turtle', 'TURTLE', '🐢', ['turtle'], 'animal'),
  P('monkey', 'MONKEY', '🐵', ['monkey'], 'animal'),
  P('elephant', 'ELEPHANT', '🐘', ['elephant'], 'animal'),
  P('lion', 'LION', '🦁', ['lion'], 'animal'),
  P('horse', 'HORSE', '🐴', ['horse'], 'animal'),
  P('sheep', 'SHEEP', '🐑', ['sheep'], 'animal'),
  P('penguin', 'PENGUIN', '🐧', ['penguin'], 'animal'),

  // ---- fruit
  P('apple', 'APPLE', '🍎', ['apple'], 'fruit'),
  P('banana', 'BANANA', '🍌', ['banana'], 'fruit'),
  P('orange', 'ORANGE', '🍊', ['orange'], 'fruit'),
  P('grapes', 'GRAPES', '🍇', ['grapes', 'grape'], 'fruit'),
  P('watermelon', 'WATERMELON', '🍉', ['watermelon', 'melon'], 'fruit'),
  P('strawberry', 'STRAWBERRY', '🍓', ['strawberry'], 'fruit'),
  P('pear', 'PEAR', '🍐', ['pear'], 'fruit'),
  P('mango', 'MANGO', '🥭', ['mango'], 'fruit'),
  P('pineapple', 'PINEAPPLE', '🍍', ['pineapple'], 'fruit'),
  P('lemon', 'LEMON', '🍋', ['lemon'], 'fruit'),
  P('cherry', 'CHERRY', '🍒', ['cherry', 'cherries'], 'fruit'),
  P('coconut', 'COCONUT', '🥥', ['coconut'], 'fruit'),

  // ---- vegetables
  P('carrot', 'CARROT', '🥕', ['carrot'], 'veg'),
  P('corn', 'CORN', '🌽', ['corn'], 'veg'),
  P('tomato', 'TOMATO', '🍅', ['tomato'], 'veg'),
  P('broccoli', 'BROCCOLI', '🥦', ['broccoli'], 'veg'),
  P('mushroom', 'MUSHROOM', '🍄', ['mushroom'], 'veg'),
  P('potato', 'POTATO', '🥔', ['potato'], 'veg'),
  P('pumpkin', 'PUMPKIN', '🎃', ['pumpkin'], 'veg'),
  P('cucumber', 'CUCUMBER', '🥒', ['cucumber'], 'veg'),

  // ---- shapes
  P('circle', 'CIRCLE', '🔵', ['circle'], 'shape'),
  P('square', 'SQUARE', '🟦', ['square'], 'shape'),
  P('triangle', 'TRIANGLE', '🔺', ['triangle'], 'shape'),
  P('star', 'STAR', '⭐', ['star'], 'shape'),
  P('heart', 'HEART', '❤️', ['heart'], 'shape'),
  P('diamond', 'DIAMOND', '🔷', ['diamond'], 'shape'),

  // ---- numbers (counting pictures, kept to a sensible share of the deck)
  P('one', '1', '⛵', ['one', 'one boat'], 'number', 'one boat'),
  P('two', '2', '🦀🦀', ['two', 'two crabs'], 'number', 'two crabs'),
  P('three', '3', '🐚🐚🐚', ['three', 'three shells'], 'number', 'three shells'),
  P('four', '4', '🐟🐟🐟🐟', ['four', 'four fish'], 'number', 'four fish'),
  P('five', '5', '⭐⭐⭐⭐⭐', ['five', 'five stars'], 'number', 'five stars'),
  P('six', '6', '🍎🍎🍎🍎🍎🍎', ['six', 'six apples'], 'number', 'six apples'),

  // ---- letters (picture + sound)
  P('a', 'A', '🍎', ['a', 'apple'], 'letter', 'apple'),
  P('b', 'B', '🦋', ['b', 'butterfly'], 'letter', 'butterfly'),
  P('c', 'C', '🥥', ['c', 'coconut'], 'letter', 'coconut'),
  P('d', 'D', '🐶', ['d', 'dog'], 'letter', 'dog'),
  P('m', 'M', '🌝', ['m', 'moon'], 'letter', 'moon'),
  P('s', 'S', '🐌', ['s', 'snail'], 'letter', 'snail'),

  // ---- everyday things
  P('ball', 'BALL', '⚽', ['ball'], 'thing'),
  P('cake', 'CAKE', '🎂', ['cake'], 'thing'),
  P('bus', 'BUS', '🚌', ['bus'], 'thing'),
  P('car', 'CAR', '🚗', ['car'], 'thing'),
  P('boat', 'BOAT', '⛵', ['boat'], 'thing'),
  P('kite', 'KITE', '🪁', ['kite'], 'thing'),
  P('bell', 'BELL', '🔔', ['bell'], 'thing'),
  P('shoe', 'SHOE', '👟', ['shoe'], 'thing'),
  P('hat', 'HAT', '🎩', ['hat'], 'thing'),
  P('cup', 'CUP', '🥤', ['cup'], 'thing'),
  P('book', 'BOOK', '📚', ['book'], 'thing'),
  P('key', 'KEY', '🔑', ['key'], 'thing'),
  P('drum', 'DRUM', '🥁', ['drum'], 'thing'),
  P('balloon', 'BALLOON', '🎈', ['balloon'], 'thing'),
  P('train', 'TRAIN', '🚂', ['train'], 'thing'),
  P('plane', 'PLANE', '✈️', ['plane', 'aeroplane', 'airplane'], 'thing'),
  P('umbrella', 'UMBRELLA', '☂️', ['umbrella'], 'thing'),
  P('clock', 'CLOCK', '🕐', ['clock'], 'thing'),

  // ---- nature
  P('sun', 'SUN', '☀️', ['sun'], 'nature'),
  P('moon', 'MOON', '🌝', ['moon'], 'nature'),
  P('tree', 'TREE', '🌳', ['tree'], 'nature'),
  P('flower', 'FLOWER', '🌸', ['flower'], 'nature'),
  P('cloud', 'CLOUD', '☁️', ['cloud'], 'nature'),
  P('rainbow', 'RAINBOW', '🌈', ['rainbow'], 'nature'),
  P('leaf', 'LEAF', '🍃', ['leaf'], 'nature'),
  P('shell', 'SHELL', '🐚', ['shell'], 'nature'),
];

// gentle per-chapter flavour — the themed categories appear a bit more often,
// but every chapter still serves the whole variety
const FLAVOUR = {
  heartland: ['animal', 'thing', 'fruit'],
  connector: ['nature', 'animal', 'letter'],
  market: ['fruit', 'veg', 'number'],
  coast: ['animal', 'nature', 'number'],
  city: ['thing', 'shape', 'letter'],
  finale: ['shape', 'thing', 'fruit'],
};

// Longer / trickier words for a 3-year-old — kept in the mix for exposure
// but dealt much less often than the simple everyday words.
const HARDER = new Set([
  'butterfly', 'elephant', 'penguin', 'watermelon', 'strawberry', 'pineapple',
  'broccoli', 'cucumber', 'mushroom', 'umbrella', 'triangle', 'diamond',
  'rainbow', 'coconut', 'balloon', 'six', 'clock',
]);

function weightFor(chapterId, c) {
  let w = HARDER.has(c.id) ? 1 : 4;            // simple words 4x as likely
  if ((FLAVOUR[chapterId] ?? []).includes(c.cat)) w *= 1.6; // gentle theme lean
  return w;
}

// Recent-history bag: pick a weighted-random card that hasn't come up in the
// last ~16, so a ride stays varied and never grinds one word. Reshuffled by
// simply reseeding the caller's rand each new play (see director).
const recent = [];
const RECENT_MAX = 16;

function deal(chapterId, rand) {
  const eligible = POOL.filter((c) => !recent.includes(c.id));
  const pool = eligible.length > 8 ? eligible : POOL;
  let total = 0;
  for (const c of pool) total += weightFor(chapterId, c);
  let r = rand() * total;
  let chosen = pool[0];
  for (const c of pool) { r -= weightFor(chapterId, c); if (r <= 0) { chosen = c; break; } }
  recent.push(chosen.id);
  while (recent.length > RECENT_MAX) recent.shift();
  return chosen;
}

export function resetDecks() { recent.length = 0; }

export function pickPair(chapterId, rand) {
  const a = deal(chapterId, rand);
  let b = deal(chapterId, rand);
  // avoid two cards that sound or look alike side by side
  let guard = 0;
  while (guard++ < 8 && (b.id === a.id || b.label[0] === a.label[0])) {
    b = deal(chapterId, rand);
  }
  return [a, b];
}

export function pickOne(chapterId, rand) {
  return deal(chapterId, rand);
}

// kept for compatibility with anything still importing CLUES
export const CLUES = Object.fromEntries(
  Object.keys(FLAVOUR).map((k) => [k, POOL]),
);
