import { describe, expect, it } from 'vitest';
import { createMatcher, normalize } from './matchingEngine.js';

describe('createMatcher', () => {
  it('uses aliases supplied by a small caller-owned vocabulary', () => {
    const matchWord = createMatcher({ aliases: { mip: ['loranzo'] } });

    expect(matchWord('LORANZO', [{ id: 'mip', say: ['mip'] }]))
      .toEqual({ id: 'mip', quality: 1 });
  });

  it('works without Rae aliases or imports', () => {
    const matchWord = createMatcher();

    expect(normalize('  MIP!  ')).toBe('mip');
    expect(matchWord('loranzo', [{ id: 'mip', say: ['mip'] }])).toBeNull();
  });
});
