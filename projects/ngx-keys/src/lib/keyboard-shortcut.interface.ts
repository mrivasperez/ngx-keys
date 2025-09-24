import { DestroyRef } from "@angular/core";
import { Observable } from "rxjs";

export type KeyboardShortcutActiveUntil = Observable<unknown> | DestroyRef | 'destruct'

export type KeyStep = string[];

export interface KeyboardShortcut {
  id: string;
  /**
   * Single-step shortcuts keep the existing shape using `keys`/`macKeys`.
   * For multi-step shortcuts, use `steps` (array of steps), where each step is an array of keys.
   * 
   * The library allows registering multiple shortcuts with the same 
   * key combination as long as they are not simultaneously active. This enables:
   * - Context-specific shortcuts (e.g., same key in different UI contexts)
   * - Alternative shortcuts for the same action 
   * - Feature toggles with same keys for different modes
   * 
   * Conflicts are only checked among active shortcuts, not all registered shortcuts.
   */
  keys?: string[];
  macKeys?: string[];
  steps?: KeyStep[];
  macSteps?: KeyStep[];
  action: () => void;
  description: string;
  activeUntil?: KeyboardShortcutActiveUntil
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
