import { describe, expect, it } from 'vitest';
import { matchWord, normalize } from './matcher.js';

const target = (id, ...say) => ({ id, say });

const desktopCommands = [
  target('left', 'left'),
  target('right', 'right'),
  target('faster', 'faster', 'fast', 'speed up'),
  target('slower', 'slower', 'slow', 'slow down'),
];

describe('normalize', () => {
  it('lowercases, removes punctuation, and collapses whitespace', () => {
    expect(normalize('  Rae\'s—BIG\n Ride!  ')).toBe('rae s big ride');
  });

  it('returns an empty string for silence-like input', () => {
    expect(normalize()).toBe('');
    expect(normalize(null)).toBe('');
    expect(normalize('  ...  ')).toBe('');
  });
});

describe('matchWord', () => {
  it('returns an exact spoken target', () => {
    expect(matchWord('DOG', [target('cat', 'cat'), target('dog', 'dog')]))
      .toEqual({ id: 'dog', quality: 1 });
  });

  it.each([
    ['kitty', target('cat', 'cat')],
    ['doggy', target('dog', 'dog')],
    ['appo', target('apple', 'apple')],
    ['wabbit', target('rabbit', 'rabbit')],
    ['fasta', target('faster', 'faster')],
    ['slowa', target('slower', 'slower')],
  ])('treats the toddler alias %s as an exact match', (heard, expectedTarget) => {
    expect(matchWord(heard, [expectedTarget]))
      .toEqual({ id: expectedTarget.id, quality: 1 });
  });

  it('returns the containment quality tier', () => {
    expect(matchWord('catsup', [target('cat', 'cat')]))
      .toEqual({ id: 'cat', quality: 0.9 });
  });

  it('returns the shared-prefix quality tier', () => {
    expect(matchWord('umbz', [target('umbrella', 'umbrella')]))
      .toEqual({ id: 'umbrella', quality: 0.8 });
  });

  it('returns the edit-distance quality tier', () => {
    expect(matchWord('cot', [target('cat', 'cat')]))
      .toEqual({ id: 'cat', quality: 0.7 });
  });

  it('returns the phonetic-skeleton quality tier', () => {
    expect(matchWord('dawg', [target('dog', 'dog')]))
      .toEqual({ id: 'dog', quality: 0.6 });
  });

  it('matches an exact token inside a longer transcript', () => {
    expect(matchWord('please choose dog now', [target('cat', 'cat'), target('dog', 'dog')]))
      .toEqual({ id: 'dog', quality: 1 });
  });

  it('matches declared multiword aliases from the full transcript', () => {
    expect(matchWord('ring ring ring', [target('bell', 'bell', 'ring ring')]))
      .toEqual({ id: 'bell', quality: 1 });
  });

  it('uses target order to resolve equally strong matching tokens', () => {
    const heard = 'cat dog';
    expect(matchWord(heard, [target('cat', 'cat'), target('dog', 'dog')]))
      .toEqual({ id: 'cat', quality: 1 });
    expect(matchWord(heard, [target('dog', 'dog'), target('cat', 'cat')]))
      .toEqual({ id: 'dog', quality: 1 });
  });

  it.each([undefined, null, '', '   ', '???', 'zzzzzz'])('returns null for silence or an unrelated transcript: %j', (heard) => {
    expect(matchWord(heard, [target('cat', 'cat'), target('dog', 'dog')])).toBeNull();
  });
});

describe('desktop command guardrails', () => {
  it.each(['light', 'ride', 'girl'])('does not give narration-like %s a free-command quality', (heard) => {
    const hit = matchWord(heard, desktopCommands);
    expect(hit?.quality ?? 0).toBeLessThan(0.9);
  });

  it.each([
    ['left', 'left'],
    ['lef', 'left'],
    ['rite', 'right'],
    ['fast', 'faster'],
    ['fasta', 'faster'],
    ['slow', 'slower'],
    ['slowa', 'slower'],
  ])('keeps real command words and aliases available: %s', (heard, id) => {
    expect(matchWord(heard, desktopCommands)).toEqual({ id, quality: 1 });
  });
});
