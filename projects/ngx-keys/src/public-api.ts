/*
 * Public API Surface of ngx-keys
 */

export * from './lib/core/keyboard-shortcuts.service';
export * from './lib/models/keyboard-shortcut.interface';
export * from './lib/errors/keyboard-shortcuts.errors';
// Export configuration types and constants
export { 
  DEFAULT_SEQUENCE_TIMEOUT_MS,
  KEYBOARD_SHORTCUTS_CONFIG
} from './lib/config/keyboard-shortcuts.config';
export type { KeyboardShortcutsConfig } from './lib/config/keyboard-shortcuts.config';
