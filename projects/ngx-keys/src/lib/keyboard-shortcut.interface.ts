export type KeyStep = string[];

export interface KeyboardShortcut {
  id: string;
  /**
   * Single-step shortcuts keep the existing shape using `keys`/`macKeys`.
   * For multi-step shortcuts, use `steps` (array of steps), where each step is an array of keys.
   */
  keys?: string[];
  macKeys?: string[];
  steps?: KeyStep[];
  macSteps?: KeyStep[];
  action: () => void;
  description: string;
}

export interface KeyboardShortcutGroup {
  id: string;
  shortcuts: KeyboardShortcut[];
  active: boolean;
}

/**
 * Interface for keyboard shortcut data optimized for UI display
 */
export interface KeyboardShortcutUI {
  id: string;
  keys: string;
  macKeys: string;
  description: string;
}
