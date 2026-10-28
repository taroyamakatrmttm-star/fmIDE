// ---------- the calculation's errors in plain words (shared: src/shared/error-words.js) ----------
// What each error code of the shared calculation (src/shared/ir.js) means, in a few plain
// words, for fmGraph and the showcase viewer: "Profit: something it reads could not be worked
// out". fmIDE keeps its own longer messages, which tell an author what to fix. A code not
// listed here (from a later version) reads "could not be worked out".
export const ERROR_WORDS = Object.freeze({
  'cycle': 'part of a circular reference',
  'alias-unset': 'an alias that points to nothing',
  'alias-missing-canvas': 'an alias to a canvas that no longer exists',
  'alias-missing-node': 'an alias to a rectangle that no longer exists',
  'no-input': 'nothing is connected to it',
  'ambiguous': 'several arrows go straight into it',
  'missing-input': 'something it reads could not be worked out',
  'period-out-of-range': 'it reads a period outside the timeline',
  'math-error': 'an invalid result (for example dividing by zero)',
  'unary-only': 'an operator that takes one input has more',
  'needs-two': 'a comparison needs two inputs',
  'block-missing-def': 'its block no longer exists',
  'block-missing-output': 'the block output it reads no longer exists',
  'block-cycle': 'a block that contains itself',
  'operator-unknown': 'an operator this version doesn\'t know',
  'operator-input-unwired': 'an operator input is not connected',
  'choose-out-of-range': 'a choose whose index picks no choice',
  'function-missing': 'a function the model doesn\'t carry',
  'function-unreadable': 'a function whose formula can\'t be read',
  'function-cycle': 'a function that calls itself',
  'function-too-deep': 'functions nested too deeply',
  'function-arguments': 'a function called with the wrong inputs',
  'function-input-unwired': 'a function input is not connected',
});

export function errorWords(code){
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(ERROR_WORDS, code) ? ERROR_WORDS[code] : 'could not be worked out';
}
