import { DestroyRef } from "@angular/core";
import { Observable } from "rxjs";

export type KeyboardShortcutActiveUntil = Observable<unknown> | DestroyRef | 'destruct'

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
  activeUntil?: KeyboardShortcutActiveUntil
}

export interface KeyboardShortcutGroup {
  id: string;
  shortcuts: KeyboardShortcut[];
  active: boolean;
}

/**
 * Filter function type for determining whether a keyboard event should be processed.
 * Return `true` to process the event (allow shortcuts), `false` to ignore it.
 * 
 * @param event - The keyboard event to evaluate
 * @returns `true` to allow shortcuts, `false` to ignore the event
 * 
 * @example
 * ```typescript
 * // Ignore shortcuts when typing in form elements
 * const inputFilter: KeyboardShortcutFilter = (event) => {
 *   const target = event.target as HTMLElement;
 *   const tagName = target?.tagName?.toLowerCase();
 *   return !['input', 'textarea', 'select'].includes(tagName) && !target?.isContentEditable;
 * };
 * 
 * keyboardService.setFilter(inputFilter);
 * ```
 */
export type KeyboardShortcutFilter = (event: KeyboardEvent) => boolean;

/**
 * Interface for keyboard shortcut data optimized for UI display
 */
export interface KeyboardShortcutUI {
  id: string;
  keys: string;
  macKeys: string;
  description: string;
}
