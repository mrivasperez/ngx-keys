import { InjectionToken } from '@angular/core';

/**
 * Configuration options for the KeyboardShortcuts service.
 */
export interface KeyboardShortcutsConfig {
  // Reserved for future configuration options
}

/**
 * Injection token for providing KeyboardShortcuts configuration.
 * 
 * @example
 * ```typescript
 * providers: [
 *   {
 *     provide: KEYBOARD_SHORTCUTS_CONFIG,
 *     useValue: {}
 *   }
 * ]
 * ```
 */
export const KEYBOARD_SHORTCUTS_CONFIG = new InjectionToken<KeyboardShortcutsConfig>(
  'KEYBOARD_SHORTCUTS_CONFIG',
  {
    providedIn: 'root',
    factory: () => ({})
  }
);

/**
 * Initial version number for state change detection.
 * Used internally to track state updates efficiently.
 * @internal
 */
export const INITIAL_STATE_VERSION = 0;

/**
 * Increment value for state version updates.
 * @internal
 */
export const STATE_VERSION_INCREMENT = 1;

/**
 * Index of the first element in an array.
 * Used for readability when checking array structure.
 * @internal
 */
export const FIRST_INDEX = 0;

/**
 * Index representing the first step in a multi-step sequence.
 * @internal
 */
export const FIRST_STEP_INDEX = 0;

/**
 * Index representing the second step in a multi-step sequence (after first step completes).
 * @internal
 */
export const SECOND_STEP_INDEX = 1;

/**
 * Threshold for determining if a shortcut is a single-step sequence.
 * @internal
 */
export const SINGLE_STEP_LENGTH = 1;

/**
 * Minimum count indicating that at least one item exists.
 * @internal
 */
export const MIN_COUNT_ONE = 1;

/**
 * Minimum length for a valid key string.
 * @internal
 */
export const MIN_KEY_LENGTH = 0;
