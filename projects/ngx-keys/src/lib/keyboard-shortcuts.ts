import {
  afterNextRender,
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  Injectable,
  OnDestroy,
  signal,
} from '@angular/core';
import { KeyboardShortcut, KeyboardShortcutActiveUntil, KeyboardShortcutFilter, KeyboardShortcutGroup, KeyboardShortcutGroupOptions, KeyboardShortcutUI, KeyStep } from './keyboard-shortcut.interface'
import { KeyboardShortcutsErrorFactory } from './keyboard-shortcuts.errors';
import { Observable, take } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class KeyboardShortcuts implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView!;

  private readonly shortcuts = new Map<string, KeyboardShortcut>();
  private readonly groups = new Map<string, KeyboardShortcutGroup>();
  private readonly activeShortcuts = new Set<string>();
  private readonly activeGroups = new Set<string>();
  private readonly currentlyDownKeys = new Set<string>();

  /**
   * Named global filters that apply to all shortcuts.
   * All global filters must return `true` for a shortcut to be processed.
   */
  private readonly globalFilters = new Map<string, KeyboardShortcutFilter>();

  // Single consolidated state signal - reduces memory overhead
  private readonly state = signal({
    shortcuts: new Map<string, KeyboardShortcut>(),
    groups: new Map<string, KeyboardShortcutGroup>(),
    activeShortcuts: new Set<string>(),
    activeGroups: new Set<string>(),
    version: 0 // for change detection optimization
  });

  // Primary computed signal - consumers derive what they need from this
  readonly shortcuts$ = computed(() => {
    const state = this.state();
    const activeShortcuts = Array.from(state.activeShortcuts)
      .map(id => state.shortcuts.get(id))
      .filter((s): s is KeyboardShortcut => s !== undefined);

    const inactiveShortcuts = Array.from(state.shortcuts.values())
      .filter(s => !state.activeShortcuts.has(s.id));

    return {
      active: activeShortcuts,
      inactive: inactiveShortcuts,
      all: Array.from(state.shortcuts.values()),
      groups: {
        active: Array.from(state.activeGroups),
        inactive: Array.from(state.groups.keys())
          .filter(id => !state.activeGroups.has(id))
      }
    };
  });

  // Optional: Pre-formatted UI signal for components that need it
  readonly shortcutsUI$ = computed(() => {
    const shortcuts = this.shortcuts$();
    return {
      active: shortcuts.active.map(s => this.formatShortcutForUI(s)),
      inactive: shortcuts.inactive.map(s => this.formatShortcutForUI(s)),
      all: shortcuts.all.map(s => this.formatShortcutForUI(s))
    };
  });

  private readonly keydownListener = this.handleKeydown.bind(this);
  private readonly keyupListener = this.handleKeyup.bind(this);
  private readonly blurListener = this.handleWindowBlur.bind(this);
  private readonly visibilityListener = this.handleVisibilityChange.bind(this);
  private isListening = false;
  /** Default timeout (ms) for completing a multi-step sequence */
  protected sequenceTimeout = 2000;

  /** Runtime state for multi-step sequences */
  private pendingSequence: {
    shortcutId: string;
    stepIndex: number;
    timerId: any;
  } | null = null;

  constructor() {
    afterNextRender(() => {
      this.startListening();
    });
  }

  ngOnDestroy(): void {
    this.stopListening();
  }

  /**
   * Batch updates and increment version for change detection
   */
  private updateState(): void {
    this.state.update(current => ({
      shortcuts: new Map(this.shortcuts),
      groups: new Map(this.groups),
      activeShortcuts: new Set(this.activeShortcuts),
      activeGroups: new Set(this.activeGroups),
      version: current.version + 1
    }));
  }

  /**
   * Utility method for UI formatting
   */
  formatShortcutForUI(shortcut: KeyboardShortcut): KeyboardShortcutUI {
    return {
      id: shortcut.id,
      keys: this.formatStepsForDisplay(shortcut.keys ?? shortcut.steps ?? [], false),
      macKeys: this.formatStepsForDisplay(shortcut.macKeys ?? shortcut.macSteps ?? [], true),
      description: shortcut.description
    };
  }

  /**
   * Utility method for batch operations - reduces signal updates
   */
  batchUpdate(operations: () => void): void {
    operations();
    this.updateState();
  }

  /**
   * Format keys for display with proper Unicode symbols
   */
  private formatKeysForDisplay(keys: string[], isMac = false): string {
    const keyMap: Record<string, string> = isMac ? {
      'ctrl': '⌃',
      'alt': '⌥',
      'shift': '⇧',
      'meta': '⌘',
      'cmd': '⌘',
      'command': '⌘'
    } : {
      'ctrl': 'Ctrl',
      'alt': 'Alt',
      'shift': 'Shift',
      'meta': 'Win'
    };

    return keys
      .map(key => keyMap[key.toLowerCase()] || key.toUpperCase())
      .join('+');
  }

  private formatStepsForDisplay(steps: string[] | string[][], isMac = false): string {
    if (!steps) return '';

    // If the first element is an array, assume steps is string[][]
    const normalized = this.normalizeToSteps(steps as KeyStep[] | string[]);
    if (normalized.length === 0) return '';
    if (normalized.length === 1) return this.formatKeysForDisplay(normalized[0], isMac);
    return normalized.map(step => this.formatKeysForDisplay(step, isMac)).join(', ');
  }

  private normalizeToSteps(input: KeyStep[] | string[]): KeyStep[] {
    if (!input) return [];
    // If first element is an array, assume already KeyStep[]
    if (Array.isArray(input[0])) {
      return input as KeyStep[];
    }
    // Single step array
    return [input as string[]];
  }

  /**
   * Check if a key combination is already registered
   * @returns The ID of the conflicting shortcut, or null if no conflict
   */
  private findConflict(newShortcut: KeyboardShortcut): string | null {
    for (const existing of this.shortcuts.values()) {
      // Compare single-step shapes if provided
      if (newShortcut.keys && existing.keys && this.keysMatch(newShortcut.keys, existing.keys)) {
        return existing.id;
      }
      if (newShortcut.macKeys && existing.macKeys && this.keysMatch(newShortcut.macKeys, existing.macKeys)) {
        return existing.id;
      }

      // Compare multi-step shapes
      if (newShortcut.steps && existing.steps && this.stepsMatch(newShortcut.steps, existing.steps)) {
        return existing.id;
      }
      if (newShortcut.macSteps && existing.macSteps && this.stepsMatch(newShortcut.macSteps, existing.macSteps)) {
        return existing.id;
      }
    }
    return null;
  }

  /**
   * Register a single keyboard shortcut
   * @throws KeyboardShortcutError if shortcut ID is already registered or key combination is in use
   */
  register(shortcut: KeyboardShortcut): void {
    if (this.shortcuts.has(shortcut.id)) {
      throw KeyboardShortcutsErrorFactory.shortcutAlreadyRegistered(shortcut.id);
    }

    const conflictId = this.findConflict(shortcut);
    if (conflictId) {
      throw KeyboardShortcutsErrorFactory.keyConflict(conflictId);
    }

    this.shortcuts.set(shortcut.id, shortcut);
    this.activeShortcuts.add(shortcut.id);
    this.updateState();

    this.setupActiveUntil(
      shortcut.activeUntil,
      this.unregister.bind(this, shortcut.id),
    );
  }

  /**
   * Register multiple keyboard shortcuts as a group
   * @param groupId - Unique identifier for the group
   * @param shortcuts - Array of shortcuts to register as a group
   * @param options - Optional configuration including filter and activeUntil
   * @throws KeyboardShortcutError if group ID is already registered or if any shortcut ID or key combination conflicts
   */
  registerGroup(groupId: string, shortcuts: KeyboardShortcut[], options?: KeyboardShortcutGroupOptions): void;
  /**
   * @deprecated Use registerGroup(groupId, shortcuts, { activeUntil }) instead
   */
  registerGroup(groupId: string, shortcuts: KeyboardShortcut[], activeUntil?: KeyboardShortcutActiveUntil): void;
  registerGroup(groupId: string, shortcuts: KeyboardShortcut[], optionsOrActiveUntil?: KeyboardShortcutGroupOptions | KeyboardShortcutActiveUntil): void {
    // Parse parameters - support both old (activeUntil) and new (options) formats
    let options: KeyboardShortcutGroupOptions;
    if (optionsOrActiveUntil && (typeof optionsOrActiveUntil === 'object') && ('filter' in optionsOrActiveUntil || 'activeUntil' in optionsOrActiveUntil)) {
      // New format with options object
      options = optionsOrActiveUntil as KeyboardShortcutGroupOptions;
    } else {
      // Old format with just activeUntil parameter
      options = { activeUntil: optionsOrActiveUntil as KeyboardShortcutActiveUntil };
    }

    // Check if group ID already exists
    if (this.groups.has(groupId)) {
      throw KeyboardShortcutsErrorFactory.groupAlreadyRegistered(groupId);
    }

    // Check for duplicate shortcut IDs and key combination conflicts
    const duplicateIds: string[] = [];
    const keyConflicts: string[] = [];
    shortcuts.forEach(shortcut => {
      if (this.shortcuts.has(shortcut.id)) {
        duplicateIds.push(shortcut.id);
      }
      const conflictId = this.findConflict(shortcut);
      if (conflictId) {
        keyConflicts.push(`"${shortcut.id}" conflicts with "${conflictId}"`);
      }
    });

    if (duplicateIds.length > 0) {
      throw KeyboardShortcutsErrorFactory.shortcutIdsAlreadyRegistered(duplicateIds);
    }

    if (keyConflicts.length > 0) {
      throw KeyboardShortcutsErrorFactory.keyConflictsInGroup(keyConflicts);
    }

    // Validate that all shortcuts have unique IDs within the group
    const groupIds = new Set<string>();
    const duplicatesInGroup: string[] = [];
    shortcuts.forEach(shortcut => {
      if (groupIds.has(shortcut.id)) {
        duplicatesInGroup.push(shortcut.id);
      } else {
        groupIds.add(shortcut.id);
      }
    });

    if (duplicatesInGroup.length > 0) {
      throw KeyboardShortcutsErrorFactory.duplicateShortcutsInGroup(duplicatesInGroup);
    }

    // Use batch update to reduce signal updates
    this.batchUpdate(() => {
      const group: KeyboardShortcutGroup = {
        id: groupId,
        shortcuts,
        active: true,
        filter: options.filter
      };

      this.groups.set(groupId, group);
      this.activeGroups.add(groupId);

      // Register individual shortcuts
      shortcuts.forEach(shortcut => {
        this.shortcuts.set(shortcut.id, shortcut);
        this.activeShortcuts.add(shortcut.id);
      });
    });

    this.setupActiveUntil(
      options.activeUntil,
      this.unregisterGroup.bind(this, groupId),
    );
  }

  /**
   * Unregister a single keyboard shortcut
   * @throws KeyboardShortcutError if shortcut ID doesn't exist
   */
  unregister(shortcutId: string): void {
    if (!this.shortcuts.has(shortcutId)) {
      throw KeyboardShortcutsErrorFactory.cannotUnregisterShortcut(shortcutId);
    }

    this.shortcuts.delete(shortcutId);
    this.activeShortcuts.delete(shortcutId);
    this.updateState();
  }

  /**
   * Unregister a group of keyboard shortcuts
   * @throws KeyboardShortcutError if group ID doesn't exist
   */
  unregisterGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) {
      throw KeyboardShortcutsErrorFactory.cannotUnregisterGroup(groupId);
    }

    this.batchUpdate(() => {
      group.shortcuts.forEach(shortcut => {
        this.shortcuts.delete(shortcut.id);
        this.activeShortcuts.delete(shortcut.id);
      });
      this.groups.delete(groupId);
      this.activeGroups.delete(groupId);
    });
  }

  /**
   * Activate a single keyboard shortcut
   * @throws KeyboardShortcutError if shortcut ID doesn't exist
   */
  activate(shortcutId: string): void {
    if (!this.shortcuts.has(shortcutId)) {
      throw KeyboardShortcutsErrorFactory.cannotActivateShortcut(shortcutId);
    }

    this.activeShortcuts.add(shortcutId);
    this.updateState();
  }

  /**
   * Deactivate a single keyboard shortcut
   * @throws KeyboardShortcutError if shortcut ID doesn't exist
   */
  deactivate(shortcutId: string): void {
    if (!this.shortcuts.has(shortcutId)) {
      throw KeyboardShortcutsErrorFactory.cannotDeactivateShortcut(shortcutId);
    }

    this.activeShortcuts.delete(shortcutId);
    this.updateState();
  }

  /**
   * Activate a group of keyboard shortcuts
   * @throws KeyboardShortcutError if group ID doesn't exist
   */
  activateGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) {
      throw KeyboardShortcutsErrorFactory.cannotActivateGroup(groupId);
    }

    this.batchUpdate(() => {
      group.active = true;
      this.activeGroups.add(groupId);
      group.shortcuts.forEach(shortcut => {
        this.activeShortcuts.add(shortcut.id);
      });
    });
  }

  /**
   * Deactivate a group of keyboard shortcuts
   * @throws KeyboardShortcutError if group ID doesn't exist
   */
  deactivateGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) {
      throw KeyboardShortcutsErrorFactory.cannotDeactivateGroup(groupId);
    }

    this.batchUpdate(() => {
      group.active = false;
      this.activeGroups.delete(groupId);
      group.shortcuts.forEach(shortcut => {
        this.activeShortcuts.delete(shortcut.id);
      });
    });
  }

  /**
   * Check if a shortcut is active
   */
  isActive(shortcutId: string): boolean {
    return this.activeShortcuts.has(shortcutId);
  }

  /**
   * Check if a shortcut is registered
   */
  isRegistered(shortcutId: string): boolean {
    return this.shortcuts.has(shortcutId);
  }

  /**
   * Check if a group is active
   */
  isGroupActive(groupId: string): boolean {
    return this.activeGroups.has(groupId);
  }

  /**
   * Check if a group is registered
   */
  isGroupRegistered(groupId: string): boolean {
    return this.groups.has(groupId);
  }

  /**
   * Get all registered shortcuts
   */
  getShortcuts(): ReadonlyMap<string, KeyboardShortcut> {
    return this.shortcuts;
  }

  /**
   * Get all registered groups
   */
  getGroups(): ReadonlyMap<string, KeyboardShortcutGroup> {
    return this.groups;
  }

  /**
   * Add a named global filter that applies to all shortcuts.
   * All global filters must return `true` for a shortcut to execute.
   * 
   * @param name - Unique name for this filter
   * @param filter - Function that returns `true` to allow shortcuts, `false` to block them
   * 
   * @example
   * ```typescript
   * // Block shortcuts in form elements
   * keyboardService.addFilter('forms', (event) => {
   *   const target = event.target as HTMLElement;
   *   const tagName = target?.tagName?.toLowerCase();
   *   return !['input', 'textarea', 'select'].includes(tagName) && !target?.isContentEditable;
   * });
   * 
   * // Block shortcuts when modal is open
   * keyboardService.addFilter('modal', (event) => {
   *   return !document.querySelector('.modal.active');
   * });
   * ```
   */
  addFilter(name: string, filter: KeyboardShortcutFilter): void {
    this.globalFilters.set(name, filter);
  }

  /**
   * Remove a named global filter.
   * 
   * @param name - Name of the filter to remove
   * @returns `true` if filter was removed, `false` if it didn't exist
   */
  removeFilter(name: string): boolean {
    return this.globalFilters.delete(name);
  }

  /**
   * Get a named global filter.
   * 
   * @param name - Name of the filter to retrieve
   * @returns The filter function, or undefined if not found
   */
  getFilter(name: string): KeyboardShortcutFilter | undefined {
    return this.globalFilters.get(name);
  }

  /**
   * Get all global filter names.
   * 
   * @returns Array of filter names
   */
  getFilterNames(): string[] {
    return Array.from(this.globalFilters.keys());
  }

  /**
   * Remove all global filters.
   */
  clearFilters(): void {
    this.globalFilters.clear();
  }

  /**
   * Check if a named filter exists.
   * 
   * @param name - Name of the filter to check
   * @returns `true` if filter exists, `false` otherwise
   */
  hasFilter(name: string): boolean {
    return this.globalFilters.has(name);
  }

  /**
   * Find the group that contains a specific shortcut.
   * 
   * @param shortcutId - The ID of the shortcut to find
   * @returns The group containing the shortcut, or undefined if not found in any group
   */
  private findGroupForShortcut(shortcutId: string): KeyboardShortcutGroup | undefined {
    for (const group of this.groups.values()) {
      if (group.shortcuts.some(s => s.id === shortcutId)) {
        return group;
      }
    }
    return undefined;
  }

  /**
   * Check if a keyboard event should be processed based on global, group, and per-shortcut filters.
   * Filter hierarchy: Global filters → Group filter → Individual shortcut filter
   * 
   * @param event - The keyboard event to evaluate
   * @param shortcut - The shortcut being evaluated (for per-shortcut filter)
   * @returns `true` if event should be processed, `false` if it should be ignored
   */
  private shouldProcessEvent(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
    // First, check all global filters - ALL must return true
    for (const globalFilter of this.globalFilters.values()) {
      if (!globalFilter(event)) {
        return false;
      }
    }

    // Then check group filter if shortcut belongs to a group
    const group = this.findGroupForShortcut(shortcut.id);
    if (group?.filter && !group.filter(event)) {
      return false;
    }

    // Finally check per-shortcut filter if it exists
    if (shortcut.filter && !shortcut.filter(event)) {
      return false;
    }

    return true;
  }

  private startListening(): void {
    if (this.isListening) {
      return;
    }

    // Listen to both keydown and keyup so we can maintain a Set of currently
    // pressed physical keys. We avoid passive:true because we may call
    // preventDefault() when matching shortcuts.
    this.document.addEventListener('keydown', this.keydownListener, { passive: false });
    this.document.addEventListener('keyup', this.keyupListener, { passive: false });
    // Listen for blur/visibility changes so we can clear the currently-down keys
    // and avoid stale state when the browser or tab loses focus.
    this.window.addEventListener('blur', this.blurListener);
    this.document.addEventListener('visibilitychange', this.visibilityListener);
    this.isListening = true;
  }

  private stopListening(): void {
    if (!this.isListening) {
      return;
    }

    this.document.removeEventListener('keydown', this.keydownListener);
    this.document.removeEventListener('keyup', this.keyupListener);
    this.window.removeEventListener('blur', this.blurListener);
    this.document.removeEventListener('visibilitychange', this.visibilityListener);
    this.isListening = false;
  }

  protected handleKeydown(event: KeyboardEvent): void {
    // Update the currently down keys with this event's key
    this.updateCurrentlyDownKeysOnKeydown(event);

    const isMac = this.isMacPlatform();

    // If there is a pending multi-step sequence, try to advance it first
    if (this.pendingSequence) {
      const pending = this.pendingSequence;
      const shortcut = this.shortcuts.get(pending.shortcutId);
      if (shortcut) {
        const steps = isMac
          ? (shortcut.macSteps ?? shortcut.macKeys ?? shortcut.steps ?? shortcut.keys ?? [])
          : (shortcut.steps ?? shortcut.keys ?? shortcut.macSteps ?? shortcut.macKeys ?? []);
        const normalizedSteps = this.normalizeToSteps(steps as KeyStep[] | string[]);
        const expected = normalizedSteps[pending.stepIndex];

        // Use per-event pressed keys for advancing sequence steps. Relying on
        // the accumulated `currentlyDownKeys` can accidentally include keys
        // from previous steps (if tests or callers don't emit keyup), which
        // would prevent matching a simple single-key step like ['s'] after
        // a prior ['k'] step. Use getPressedKeys(event) which reflects the
        // actual modifier/main-key state for this event.
        const stepPressed = this.getPressedKeys(event);

        if (expected && this.keysMatch(stepPressed, expected)) {
          // Advance sequence
          clearTimeout(pending.timerId);
          pending.stepIndex += 1;

          if (pending.stepIndex >= normalizedSteps.length) {
            // Completed - check filters before executing
            if (!this.shouldProcessEvent(event, shortcut)) {
              this.pendingSequence = null;
              return; // Skip execution due to filters
            }

            event.preventDefault();
            event.stopPropagation();
            try {
              shortcut.action();
            } catch (error) {
              console.error(`Error executing keyboard shortcut "${shortcut.id}":`, error);
            }
            this.pendingSequence = null;
            return;
          }

          // Reset timer for next step
          pending.timerId = setTimeout(() => { this.pendingSequence = null; }, this.sequenceTimeout);
          return;
        } else {
          // Cancel pending if doesn't match
          this.clearPendingSequence();
        }
      } else {
        // pending exists but shortcut not found
        this.clearPendingSequence();
      }
    }

    // No pending sequence - check active shortcuts for a match or sequence start
    for (const shortcutId of this.activeShortcuts) {
      const shortcut = this.shortcuts.get(shortcutId);
      if (!shortcut) continue;

      const steps = isMac
        ? (shortcut.macSteps ?? shortcut.macKeys ?? shortcut.steps ?? shortcut.keys ?? [])
        : (shortcut.steps ?? shortcut.keys ?? shortcut.macSteps ?? shortcut.macKeys ?? []);
      const normalizedSteps = this.normalizeToSteps(steps as KeyStep[] | string[]);

      const firstStep = normalizedSteps[0];

      // Decide which pressed-keys representation to use for this shortcut's
      // expected step: if it requires multiple non-modifier keys, treat it as
      // a chord and use accumulated keys; otherwise use per-event keys to avoid
      // interference from previously pressed non-modifier keys.
      const nonModifierCount = firstStep.filter(k => !['ctrl', 'alt', 'shift', 'meta'].includes(k.toLowerCase())).length;
      const pressedForStep: Set<string> | string[] = nonModifierCount > 1
        ? this.buildPressedKeysForMatch(event)
        : this.getPressedKeys(event);

      if (this.keysMatch(pressedForStep, firstStep)) {
        // Check if this event should be processed based on filters
        if (!this.shouldProcessEvent(event, shortcut)) {
          continue; // Skip this shortcut due to filters
        }

        if (normalizedSteps.length === 1) {
          // single-step
          event.preventDefault();
          event.stopPropagation();
          try {
            shortcut.action();
          } catch (error) {
            console.error(`Error executing keyboard shortcut "${shortcut.id}":`, error);
          }
          break;
        } else {
          // start pending sequence
          if (this.pendingSequence) {
            this.clearPendingSequence();
          }
          this.pendingSequence = {
            shortcutId: shortcut.id,
            stepIndex: 1,
            timerId: setTimeout(() => { this.pendingSequence = null; }, this.sequenceTimeout)
          };
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
    }
  }

  protected handleKeyup(event: KeyboardEvent): void {
    // Remove the key from currentlyDownKeys on keyup
    const key = event.key ? event.key.toLowerCase() : '';
    if (key && !['control', 'alt', 'shift', 'meta'].includes(key)) {
      this.currentlyDownKeys.delete(key);
    }
  }

  /**
   * Clear the currently-down keys. Exposed for testing and for use by
   * blur/visibilitychange handlers to avoid stale state when the page loses focus.
   */
  clearCurrentlyDownKeys(): void {
    this.currentlyDownKeys.clear();
  }

  protected handleWindowBlur(): void {
    this.clearCurrentlyDownKeys();
    // Clear any pressed keys and any pending multi-step sequence to avoid
    // stale state when the window loses focus.
    this.clearPendingSequence();
  }

  protected handleVisibilityChange(): void {
    if (this.document.visibilityState === 'hidden') {
      // When the document becomes hidden, clear both pressed keys and any
      // pending multi-step sequence. This prevents sequences from remaining
      // active when the user switches tabs or minimizes the window.
      this.clearCurrentlyDownKeys();
      this.clearPendingSequence();
    }
  }

  /**
   * Update the currentlyDownKeys set when keydown events happen.
   * Normalizes common keys (function keys, space, etc.) to the same values
   * used by getPressedKeys/keysMatch.
   */
  protected updateCurrentlyDownKeysOnKeydown(event: KeyboardEvent): void {
    const key = event.key ? event.key.toLowerCase() : '';

    // Ignore modifier-only keydown entries
    if (['control', 'alt', 'shift', 'meta'].includes(key)) {
      return;
    }

    // Normalize some special cases similar to the demo component's recording logic
    if (event.code && event.code.startsWith('F') && /^F\d+$/.test(event.code)) {
      this.currentlyDownKeys.add(event.code.toLowerCase());
      return;
    }

    if (key === ' ') {
      this.currentlyDownKeys.add('space');
      return;
    }

    if (key === 'escape') {
      this.currentlyDownKeys.add('escape');
      return;
    }

    if (key === 'enter') {
      this.currentlyDownKeys.add('enter');
      return;
    }

    if (key && key.length > 0) {
      this.currentlyDownKeys.add(key);
    }
  }

  /**
   * Build the pressed keys set used for matching against registered shortcuts.
   * If multiple non-modifier keys are currently down, include them (chord support).
   * Otherwise fall back to single main-key detection from the event for compatibility.
   *
   * Returns a Set<string> (lowercased) to allow O(1) lookups and O(n) comparisons
   * without sorting or allocating sorted arrays on every event.
   */
  protected buildPressedKeysForMatch(event: KeyboardEvent): Set<string> {
    const modifiers = new Set<string>();
    if (event.ctrlKey) modifiers.add('ctrl');
    if (event.altKey) modifiers.add('alt');
    if (event.shiftKey) modifiers.add('shift');
    if (event.metaKey) modifiers.add('meta');

    // Collect non-modifier keys from currentlyDownKeys (excluding modifiers)
    const nonModifierKeys = Array.from(this.currentlyDownKeys).filter(k => !['control', 'alt', 'shift', 'meta'].includes(k));

    const result = new Set<string>();
    // Add modifiers first
    modifiers.forEach(m => result.add(m));

    if (nonModifierKeys.length > 0) {
      nonModifierKeys.forEach(k => result.add(k.toLowerCase()));
      return result;
    }

    // Fallback: single main key from the event (existing behavior)
    const key = event.key.toLowerCase();
    if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
      result.add(key);
    }
    return result;
  }

  protected getPressedKeys(event: KeyboardEvent): string[] {
    const keys: string[] = [];

    if (event.ctrlKey) keys.push('ctrl');
    if (event.altKey) keys.push('alt');
    if (event.shiftKey) keys.push('shift');
    if (event.metaKey) keys.push('meta');

    // Add the main key (normalize to lowercase)
    const key = event.key.toLowerCase();
    if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
      keys.push(key);
    }

    return keys;
  }

  /**
   * Compare pressed keys against a target key combination.
   * Accepts either a Set<string> (preferred) or an array for backwards compatibility.
   * Uses Set-based comparison: sizes must match and every element in target must exist in pressed.
   */
  protected keysMatch(pressedKeys: Set<string> | string[], targetKeys: string[]): boolean {
    // Normalize targetKeys into a Set<string> (lowercased)
    const normalizedTarget = new Set<string>(targetKeys.map(k => k.toLowerCase()));

    // Normalize pressedKeys into a Set<string> if it's an array
    const pressedSet: Set<string> = Array.isArray(pressedKeys)
      ? new Set<string>(pressedKeys.map(k => k.toLowerCase()))
      : new Set<string>(Array.from(pressedKeys).map(k => k.toLowerCase()));

    if (pressedSet.size !== normalizedTarget.size) {
      return false;
    }

    // Check if every element in normalizedTarget exists in pressedSet
    for (const key of normalizedTarget) {
      if (!pressedSet.has(key)) {
        return false;
      }
    }

    return true;
  }

  /** Compare two multi-step sequences for equality */
  protected stepsMatch(a: string[][], b: string[][]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!this.keysMatch(a[i], b[i])) return false;
    }
    return true;
  }

  /** Safely clear any pending multi-step sequence */
  private clearPendingSequence(): void {
    if (!this.pendingSequence) return;
    try {
      clearTimeout(this.pendingSequence.timerId);
    } catch { /* ignore */ }
    this.pendingSequence = null;
  }

  protected isMacPlatform(): boolean {
    return /Mac|iPod|iPhone|iPad/.test(this.window.navigator.platform ?? '');
  }

  protected setupActiveUntil(activeUntil: KeyboardShortcutActiveUntil | undefined, unregister: () => void) {
    if (!activeUntil) {
      return
    }

    if (activeUntil === 'destruct') {
      inject(DestroyRef).onDestroy(unregister);
      return
    }

    // Support both real DestroyRef instances and duck-typed objects (e.g.,
    // Jasmine spies) that expose an onDestroy(fn) method for backwards
    // compatibility with earlier APIs and tests.
    if ((activeUntil as any) instanceof DestroyRef || typeof (activeUntil as any).onDestroy === 'function') {
      (activeUntil as any).onDestroy(unregister);
      return
    }

    if (activeUntil instanceof Observable) {
      activeUntil.pipe(take(1)).subscribe(unregister);
      return
    }
  }
}
