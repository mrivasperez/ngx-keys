/**
 * Utility class for keyboard shortcut key matching and normalization.
 * Provides methods for comparing key combinations and normalizing key input.
 */
export class KeyMatcher {
  private static readonly MODIFIER_KEYS = new Set(['ctrl', 'control', 'alt', 'shift', 'meta']);

  /**
   * Normalize a key string to lowercase for consistent comparison.
   * 
   * @param key - The key string to normalize
   * @returns The normalized (lowercase) key string
   * 
   * @example
   * ```typescript
   * KeyMatcher.normalizeKey('Ctrl'); // returns 'ctrl'
   * KeyMatcher.normalizeKey('A');    // returns 'a'
   * ```
   */
  static normalizeKey(key: string): string {
    return key.toLowerCase();
  }

  /**
   * Check if a key is a modifier key (ctrl, alt, shift, meta).
   * 
   * @param key - The key to check
   * @returns true if the key is a modifier key
   * 
   * @example
   * ```typescript
   * KeyMatcher.isModifierKey('ctrl');  // returns true
   * KeyMatcher.isModifierKey('a');     // returns false
   * ```
   */
  static isModifierKey(key: string): boolean {
    return this.MODIFIER_KEYS.has(key.toLowerCase());
  }

  /**
   * Compare two key combinations for equality.
   * Supports both Set<string> and string[] as input.
   * Keys are normalized (lowercased) before comparison.
   * 
   * @param a - First key combination (Set or array)
   * @param b - Second key combination (array)
   * @returns true if both combinations contain the same keys
   * 
   * @example
   * ```typescript
   * KeyMatcher.keysMatch(['ctrl', 's'], ['ctrl', 's']); // returns true
   * KeyMatcher.keysMatch(['ctrl', 's'], ['Ctrl', 'S']); // returns true (normalized)
   * KeyMatcher.keysMatch(['ctrl', 's'], ['alt', 's']);  // returns false
   * ```
   */
  static keysMatch(a: Set<string> | string[], b: string[]): boolean {
    const setA = a instanceof Set ? a : this.normalizeKeysToSet(a);
    const setB = this.normalizeKeysToSet(b);

    if (setA.size !== setB.size) {
      return false;
    }

    for (const key of setA) {
      if (!setB.has(key)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Compare two multi-step sequences for equality.
   * Each sequence is an array of steps, where each step is an array of keys.
   * 
   * @param a - First multi-step sequence
   * @param b - Second multi-step sequence
   * @returns true if both sequences are identical
   * 
   * @example
   * ```typescript
   * const seq1 = [['ctrl', 'k'], ['s']];
   * const seq2 = [['ctrl', 'k'], ['s']];
   * KeyMatcher.stepsMatch(seq1, seq2); // returns true
   * 
   * const seq3 = [['ctrl', 'k'], ['t']];
   * KeyMatcher.stepsMatch(seq1, seq3); // returns false (different final step)
   * ```
   */
  static stepsMatch(a: string[][], b: string[][]): boolean {
    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (!this.keysMatch(a[i], b[i])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Normalize an array of keys to a Set of lowercase keys.
   * 
   * @param keys - Array of keys to normalize
   * @returns Set of normalized (lowercase) keys
   * 
   * @internal
   */
  private static normalizeKeysToSet(keys: string[]): Set<string> {
    return new Set(keys.map(k => k.toLowerCase()));
  }

  /**
   * Get the set of modifier key names.
   * Useful for filtering or checking if a key is a modifier.
   * 
   * @returns ReadonlySet of modifier key names
   * 
   * @example
   * ```typescript
   * const modifiers = KeyMatcher.getModifierKeys();
   * console.log(modifiers.has('ctrl')); // true
   * console.log(modifiers.has('a'));    // false
   * ```
   */
  static getModifierKeys(): ReadonlySet<string> {
    return this.MODIFIER_KEYS;
  }
}
