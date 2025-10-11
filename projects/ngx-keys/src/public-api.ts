/*
 * Public API Surface of ngx-keys
 */

export * from './lib/core/keyboard-shortcuts.service';
export * from './lib/models/keyboard-shortcut.interface';
export * from './lib/errors/keyboard-shortcuts.errors';
export { 
  KEYBOARD_SHORTCUTS_CONFIG,
  provideKeyboardShortcutsConfig
} from './lib/config/keyboard-shortcuts.config';
export type { KeyboardShortcutsConfig } from './lib/config/keyboard-shortcuts.config';
export { KeyMatcher } from './lib/core/utils/key-matcher';
