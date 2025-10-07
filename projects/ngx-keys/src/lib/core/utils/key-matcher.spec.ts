import { KeyMatcher } from './key-matcher';

describe('KeyMatcher', () => {
  describe('normalizeKey', () => {
    it('should convert keys to lowercase', () => {
      expect(KeyMatcher.normalizeKey('Ctrl')).toBe('ctrl');
      expect(KeyMatcher.normalizeKey('A')).toBe('a');
      expect(KeyMatcher.normalizeKey('SHIFT')).toBe('shift');
    });

    it('should handle already lowercase keys', () => {
      expect(KeyMatcher.normalizeKey('ctrl')).toBe('ctrl');
      expect(KeyMatcher.normalizeKey('a')).toBe('a');
    });

    it('should handle empty strings', () => {
      expect(KeyMatcher.normalizeKey('')).toBe('');
    });
  });

  describe('isModifierKey', () => {
    it('should return true for modifier keys', () => {
      expect(KeyMatcher.isModifierKey('ctrl')).toBe(true);
      expect(KeyMatcher.isModifierKey('alt')).toBe(true);
      expect(KeyMatcher.isModifierKey('shift')).toBe(true);
      expect(KeyMatcher.isModifierKey('meta')).toBe(true);
      expect(KeyMatcher.isModifierKey('control')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(KeyMatcher.isModifierKey('CTRL')).toBe(true);
      expect(KeyMatcher.isModifierKey('Shift')).toBe(true);
      expect(KeyMatcher.isModifierKey('META')).toBe(true);
    });

    it('should return false for non-modifier keys', () => {
      expect(KeyMatcher.isModifierKey('a')).toBe(false);
      expect(KeyMatcher.isModifierKey('enter')).toBe(false);
      expect(KeyMatcher.isModifierKey('escape')).toBe(false);
      expect(KeyMatcher.isModifierKey('f1')).toBe(false);
    });
  });

  describe('keysMatch', () => {
    it('should match identical key arrays', () => {
      expect(KeyMatcher.keysMatch(['ctrl', 's'], ['ctrl', 's'])).toBe(true);
      expect(KeyMatcher.keysMatch(['alt', 'shift', 'a'], ['alt', 'shift', 'a'])).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(KeyMatcher.keysMatch(['ctrl', 's'], ['Ctrl', 'S'])).toBe(true);
      expect(KeyMatcher.keysMatch(['SHIFT', 'A'], ['shift', 'a'])).toBe(true);
    });

    it('should match regardless of order', () => {
      expect(KeyMatcher.keysMatch(['ctrl', 's'], ['s', 'ctrl'])).toBe(true);
      expect(KeyMatcher.keysMatch(['alt', 'shift', 'a'], ['a', 'shift', 'alt'])).toBe(true);
    });

    it('should work with Sets', () => {
      const set = new Set(['ctrl', 's']);
      expect(KeyMatcher.keysMatch(set, ['ctrl', 's'])).toBe(true);
      expect(KeyMatcher.keysMatch(set, ['s', 'ctrl'])).toBe(true);
    });

    it('should not match different key combinations', () => {
      expect(KeyMatcher.keysMatch(['ctrl', 's'], ['ctrl', 'a'])).toBe(false);
      expect(KeyMatcher.keysMatch(['alt', 's'], ['ctrl', 's'])).toBe(false);
    });

    it('should not match different lengths', () => {
      expect(KeyMatcher.keysMatch(['ctrl', 's'], ['ctrl', 's', 'a'])).toBe(false);
      expect(KeyMatcher.keysMatch(['ctrl', 's', 'a'], ['ctrl', 's'])).toBe(false);
    });

    it('should handle empty arrays', () => {
      expect(KeyMatcher.keysMatch([], [])).toBe(true);
      expect(KeyMatcher.keysMatch(['a'], [])).toBe(false);
      expect(KeyMatcher.keysMatch([], ['a'])).toBe(false);
    });

    it('should handle single keys', () => {
      expect(KeyMatcher.keysMatch(['escape'], ['escape'])).toBe(true);
      expect(KeyMatcher.keysMatch(['enter'], ['ENTER'])).toBe(true);
    });
  });

  describe('stepsMatch', () => {
    it('should match identical multi-step sequences', () => {
      const seq1 = [['ctrl', 'k'], ['s']];
      const seq2 = [['ctrl', 'k'], ['s']];
      expect(KeyMatcher.stepsMatch(seq1, seq2)).toBe(true);
    });

    it('should be case-insensitive', () => {
      const seq1 = [['ctrl', 'k'], ['s']];
      const seq2 = [['Ctrl', 'K'], ['S']];
      expect(KeyMatcher.stepsMatch(seq1, seq2)).toBe(true);
    });

    it('should not match different sequences', () => {
      const seq1 = [['ctrl', 'k'], ['s']];
      const seq2 = [['ctrl', 'k'], ['t']];
      expect(KeyMatcher.stepsMatch(seq1, seq2)).toBe(false);
    });

    it('should not match different sequence lengths', () => {
      const seq1 = [['ctrl', 'k'], ['s']];
      const seq2 = [['ctrl', 'k'], ['s'], ['a']];
      expect(KeyMatcher.stepsMatch(seq1, seq2)).toBe(false);
    });

    it('should not match sequences with different step order', () => {
      const seq1 = [['ctrl', 'k'], ['s']];
      const seq2 = [['s'], ['ctrl', 'k']];
      expect(KeyMatcher.stepsMatch(seq1, seq2)).toBe(false);
    });

    it('should handle single-step sequences', () => {
      const seq1 = [['ctrl', 's']];
      const seq2 = [['ctrl', 's']];
      expect(KeyMatcher.stepsMatch(seq1, seq2)).toBe(true);
    });

    it('should handle empty sequences', () => {
      expect(KeyMatcher.stepsMatch([], [])).toBe(true);
      expect(KeyMatcher.stepsMatch([['a']], [])).toBe(false);
    });

    it('should handle complex multi-step sequences', () => {
      const seq1 = [['ctrl', 'k'], ['ctrl', 's'], ['enter']];
      const seq2 = [['ctrl', 'k'], ['ctrl', 's'], ['enter']];
      expect(KeyMatcher.stepsMatch(seq1, seq2)).toBe(true);
    });

    it('should match steps regardless of key order within steps', () => {
      const seq1 = [['ctrl', 'shift', 'k'], ['s']];
      const seq2 = [['shift', 'ctrl', 'k'], ['s']];
      expect(KeyMatcher.stepsMatch(seq1, seq2)).toBe(true);
    });
  });

  describe('getModifierKeys', () => {
    it('should return a set of modifier keys', () => {
      const modifiers = KeyMatcher.getModifierKeys();
      expect(modifiers.has('ctrl')).toBe(true);
      expect(modifiers.has('control')).toBe(true);
      expect(modifiers.has('alt')).toBe(true);
      expect(modifiers.has('shift')).toBe(true);
      expect(modifiers.has('meta')).toBe(true);
    });

    it('should not include non-modifier keys', () => {
      const modifiers = KeyMatcher.getModifierKeys();
      expect(modifiers.has('a')).toBe(false);
      expect(modifiers.has('enter')).toBe(false);
    });

    it('should return the same reference', () => {
      const modifiers1 = KeyMatcher.getModifierKeys();
      const modifiers2 = KeyMatcher.getModifierKeys();
      expect(modifiers1).toBe(modifiers2);
    });
  });
});
