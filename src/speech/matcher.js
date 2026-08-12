// Backward-compatible Rae adapter. Existing game call sites keep importing
// normalize and matchWord from here while the engine remains vocabulary-free.
import { createMatcher } from './matchingEngine.js';
import { RAE_ALIASES } from './raeLexicon.js';

export { normalize } from './matchingEngine.js';

export const matchWord = createMatcher({ aliases: RAE_ALIASES });
