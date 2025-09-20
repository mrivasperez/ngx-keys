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
  activeUntil?: KeyboardShortcutActiveUntil;
  /**
   * Optional filter function for this specific shortcut.
   * If provided, this filter is evaluated AFTER global filters.
   * Both global filters AND this filter must return true for the shortcut to execute.
   * 
   * @param event - The keyboard event to evaluate
   * @returns `true` to allow this shortcut, `false` to ignore the event
   * 
   * @example
   * ```typescript
   * // This shortcut works everywhere, even bypassing global input filters
   * {
   *   id: 'emergency-save',
   *   keys: ['ctrl', 'shift', 's'],
   *   action: () => this.emergencySave(),
   *   filter: () => true, // Always allow
   *   description: 'Emergency save (works in inputs)'
   * }
   * ```
   */
  filter?: KeyboardShortcutFilter;
}

export interface KeyboardShortcutGroup {
  id: string;
  shortcuts: KeyboardShortcut[];
  active: boolean;
  /**
   * Optional filter function for this entire group.
   * If provided, this filter is evaluated AFTER global filters but BEFORE individual shortcut filters.
   * The filter hierarchy is: Global filters → Group filter → Individual shortcut filter.
   * All applicable filters must return true for a shortcut to execute.
   * 
   * @param event - The keyboard event to evaluate
   * @returns `true` to allow shortcuts in this group, `false` to ignore the event
   * 
   * @example
   * ```typescript
   * // Modal shortcuts group that only works when modal is active
   * keyboardService.registerGroup('modal-shortcuts', shortcuts, {
   *   filter: (event) => !!document.querySelector('.modal.active')
   * });
   * ```
   */
  filter?: KeyboardShortcutFilter;
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
 * Options for registering a group of keyboard shortcuts
 */
export interface KeyboardShortcutGroupOptions {
  /**
   * Optional filter function for the entire group.
   * This filter is evaluated after global filters but before individual shortcut filters.
   */
  filter?: KeyboardShortcutFilter;
  /**
   * Optional lifecycle management for automatic cleanup
   */
  activeUntil?: KeyboardShortcutActiveUntil;
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
