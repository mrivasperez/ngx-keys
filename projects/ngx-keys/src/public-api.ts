/*
 * Public API Surface of ngx-keys
 */

export * from './lib/keyboard-shortcuts';
export * from './lib/keyboard-shortcut.interface';
export * from './lib/keyboard-shortcuts.errors';
// Export configuration types and constants
export { 
  DEFAULT_SEQUENCE_TIMEOUT_MS,
  KEYBOARD_SHORTCUTS_CONFIG
} from './lib/keyboard-shortcuts.constants';
export type { KeyboardShortcutsConfig } from './lib/keyboard-shortcuts.constants';
