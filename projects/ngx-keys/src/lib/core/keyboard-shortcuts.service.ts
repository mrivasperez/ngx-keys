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
import { KeyboardShortcut, KeyboardShortcutActiveUntil, KeyboardShortcutFilter, KeyboardShortcutGroup, KeyboardShortcutGroupOptions, KeyboardShortcutUI, KeyStep } from '../models/keyboard-shortcut.interface'
import { KeyboardShortcutsErrorFactory } from '../errors/keyboard-shortcuts.errors';
import { Observable, take } from 'rxjs';
import {
  INITIAL_STATE_VERSION,
  STATE_VERSION_INCREMENT,
  FIRST_INDEX,
  FIRST_STEP_INDEX,
  SECOND_STEP_INDEX,
  SINGLE_STEP_LENGTH,
  MIN_COUNT_ONE,
  MIN_KEY_LENGTH,
  KEYBOARD_SHORTCUTS_CONFIG
} from '../config/keyboard-shortcuts.config';
import { KeyMatcher } from './utils/key-matcher';

/**
 * Type guard to detect KeyboardShortcutGroupOptions at runtime.
 * Centralising this logic keeps registerGroup simpler and less fragile.
 */
function isGroupOptions(param: unknown): param is KeyboardShortcutGroupOptions {
  if (!param || typeof param !== 'object') return false;
  // Narrow to object for property checks
  const obj = param as Record<string, unknown>;
  return ('filter' in obj) || ('activeUntil' in obj);
}

/**
 * Detect real DestroyRef instances or duck-typed objects exposing onDestroy(fn).
 * Returns true for either an actual DestroyRef or an object with an onDestroy method.
 */
function isDestroyRefLike(obj: unknown): obj is DestroyRef & { onDestroy: (fn: () => void) => void } {
  if (!obj || typeof obj !== 'object') return false;
  try {
    // Prefer instanceof when available (real DestroyRef)
    if (obj instanceof DestroyRef) return true;
  } catch {
    // instanceof may throw if DestroyRef is not constructable in certain runtimes/tests
  }

  const o = obj as Record<string, unknown>;
  return typeof o['onDestroy'] === 'function';
}

@Injectable({
  providedIn: 'root'
})
export class KeyboardShortcuts implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView!;
  private readonly config = inject(KEYBOARD_SHORTCUTS_CONFIG);

  private readonly shortcuts = new Map<string, KeyboardShortcut>();
  private readonly groups = new Map<string, KeyboardShortcutGroup>();
  private readonly activeShortcuts = new Set<string>();
  private readonly activeGroups = new Set<string>();
  private readonly currentlyDownKeys = new Set<string>();
  // O(1) lookup from shortcutId to its groupId to avoid scanning all groups per event
  private readonly shortcutToGroup = new Map<string, string>();

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
    version: INITIAL_STATE_VERSION // for change detection optimization
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

  /** Runtime state for multi-step sequences */
  private pendingSequence: {
    shortcutId: string;
    stepIndex: number;
    timerId: any | null;
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
      version: current.version + STATE_VERSION_INCREMENT
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
    if (normalized.length === MIN_KEY_LENGTH) return '';
    if (normalized.length === SINGLE_STEP_LENGTH) return this.formatKeysForDisplay(normalized[FIRST_INDEX], isMac);
    return normalized.map(step => this.formatKeysForDisplay(step, isMac)).join(', ');
  }

  private normalizeToSteps(input: KeyStep[] | string[]): KeyStep[] {
    if (!input) return [];
    // If first element is an array, assume already KeyStep[]
    if (Array.isArray(input[FIRST_INDEX])) {
      return input as KeyStep[];
    }
    // Single step array
    return [input as string[]];
  }

  /**
   * Check if a key combination is already registered by an active shortcut
   * @returns The ID of the conflicting active shortcut, or null if no active conflict
   */
  private findActiveConflict(newShortcut: KeyboardShortcut): string | null {
    for (const existing of this.shortcuts.values()) {
      // Only check conflicts with active shortcuts
      if (!this.activeShortcuts.has(existing.id)) {
        continue;
      }

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
   * Check if activating a shortcut would create key conflicts with other active shortcuts
   * @returns Array of conflicting shortcut IDs that would be created by activation
   */
  private findActivationConflicts(shortcutId: string): string[] {
    const shortcut = this.shortcuts.get(shortcutId);
    if (!shortcut) return [];

    const conflicts: string[] = [];
    for (const existing of this.shortcuts.values()) {
      // Skip self and inactive shortcuts
      if (existing.id === shortcutId || !this.activeShortcuts.has(existing.id)) {
        continue;
      }

      // Check for key conflicts
      if ((shortcut.keys && existing.keys && this.keysMatch(shortcut.keys, existing.keys)) ||
          (shortcut.macKeys && existing.macKeys && this.keysMatch(shortcut.macKeys, existing.macKeys)) ||
          (shortcut.steps && existing.steps && this.stepsMatch(shortcut.steps, existing.steps)) ||
          (shortcut.macSteps && existing.macSteps && this.stepsMatch(shortcut.macSteps, existing.macSteps))) {
        conflicts.push(existing.id);
      }
    }
    return conflicts;
  }

  /**
   * Register a single keyboard shortcut
   * @throws KeyboardShortcutError if shortcut ID is already registered or if the shortcut would conflict with currently active shortcuts
   */
  register(shortcut: KeyboardShortcut): void {
    if (this.shortcuts.has(shortcut.id)) {
      throw KeyboardShortcutsErrorFactory.shortcutAlreadyRegistered(shortcut.id);
    }

    // Check for conflicts only with currently active shortcuts
    const conflictId = this.findActiveConflict(shortcut);
    if (conflictId) {
      throw KeyboardShortcutsErrorFactory.activeKeyConflict(conflictId);
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
    if (isGroupOptions(optionsOrActiveUntil)) {
      // New format with options object
      options = optionsOrActiveUntil;
    } else {
      // Old format with just activeUntil parameter
      options = { activeUntil: optionsOrActiveUntil as KeyboardShortcutActiveUntil };
    }

    // Check if group ID already exists
    if (this.groups.has(groupId)) {
      throw KeyboardShortcutsErrorFactory.groupAlreadyRegistered(groupId);
    }
    
    // Check for duplicate shortcut IDs and key combination conflicts with active shortcuts
    const duplicateIds: string[] = [];
    const keyConflicts: string[] = [];
    shortcuts.forEach(shortcut => {
      if (this.shortcuts.has(shortcut.id)) {
        duplicateIds.push(shortcut.id);
      }
      const conflictId = this.findActiveConflict(shortcut);
      if (conflictId) {
        keyConflicts.push(`"${shortcut.id}" conflicts with active shortcut "${conflictId}"`);
      }
    });

    if (duplicateIds.length > MIN_KEY_LENGTH) {
      throw KeyboardShortcutsErrorFactory.shortcutIdsAlreadyRegistered(duplicateIds);
    }

    if (keyConflicts.length > MIN_KEY_LENGTH) {
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

    if (duplicatesInGroup.length > MIN_KEY_LENGTH) {
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
        this.shortcutToGroup.set(shortcut.id, groupId);
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
    this.shortcutToGroup.delete(shortcutId);
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
        this.shortcutToGroup.delete(shortcut.id);
      });
      this.groups.delete(groupId);
      this.activeGroups.delete(groupId);
    });
  }



  /**
   * Activate a single keyboard shortcut
   * @throws KeyboardShortcutError if shortcut ID doesn't exist or if activation would create key conflicts
   */
  activate(shortcutId: string): void {
    if (!this.shortcuts.has(shortcutId)) {
      throw KeyboardShortcutsErrorFactory.cannotActivateShortcut(shortcutId);
    }

    // Check for conflicts that would be created by activation
    const conflicts = this.findActivationConflicts(shortcutId);
    if (conflicts.length > MIN_KEY_LENGTH) {
      throw KeyboardShortcutsErrorFactory.activationKeyConflict(shortcutId, conflicts);
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
   * @throws KeyboardShortcutError if group ID doesn't exist or if activation would create key conflicts
   */
  activateGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) {
      throw KeyboardShortcutsErrorFactory.cannotActivateGroup(groupId);
    }

    // Check for conflicts that would be created by activating all shortcuts in the group
    const allConflicts: string[] = [];
    group.shortcuts.forEach(shortcut => {
      const conflicts = this.findActivationConflicts(shortcut.id);
      allConflicts.push(...conflicts);
    });

    if (allConflicts.length > MIN_KEY_LENGTH) {
      throw KeyboardShortcutsErrorFactory.groupActivationKeyConflict(groupId, allConflicts);
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
   * Remove the filter from a specific group
   * @param groupId - The group ID
   * @throws KeyboardShortcutError if group doesn't exist
   */
  removeGroupFilter(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) {
      throw KeyboardShortcutsErrorFactory.cannotDeactivateGroup(groupId);
    }

    if (!group.filter) {
      // No filter to remove, silently succeed
      return;
    }

    this.groups.set(groupId, {
      ...group,
      filter: undefined
    });

    this.updateState();
  }

  /**
   * Remove the filter from a specific shortcut
   * @param shortcutId - The shortcut ID
   * @throws KeyboardShortcutError if shortcut doesn't exist
   */
  removeShortcutFilter(shortcutId: string): void {
    const shortcut = this.shortcuts.get(shortcutId);
    if (!shortcut) {
      throw KeyboardShortcutsErrorFactory.cannotDeactivateShortcut(shortcutId);
    }

    if (!shortcut.filter) {
      // No filter to remove, silently succeed
      return;
    }

    this.shortcuts.set(shortcutId, {
      ...shortcut,
      filter: undefined
    });

    this.updateState();
  }

  /**
   * Remove all filters from all groups
   */
  clearAllGroupFilters(): void {
    this.batchUpdate(() => {
      this.groups.forEach((group, id) => {
        if (group.filter) {
          this.removeGroupFilter(id);
        }
      });
    });
  }

  /**
   * Remove all filters from all shortcuts
   */
  clearAllShortcutFilters(): void {
    this.batchUpdate(() => {
      this.shortcuts.forEach((shortcut, id) => {
        if (shortcut.filter) {
          this.removeShortcutFilter(id);
        }
      });
    });
  }

  /**
   * Check if a group has a filter
   * @param groupId - The group ID
   * @returns True if the group has a filter
   */
  hasGroupFilter(groupId: string): boolean {
    const group = this.groups.get(groupId);
    return !!group?.filter;
  }

  /**
   * Check if a shortcut has a filter
   * @param shortcutId - The shortcut ID
   * @returns True if the shortcut has a filter
   */
  hasShortcutFilter(shortcutId: string): boolean {
    const shortcut = this.shortcuts.get(shortcutId);
    return !!shortcut?.filter;
  }

  /**
   * Register multiple shortcuts in a single batch update
   * @param shortcuts - Array of shortcuts to register
   */
  registerMany(shortcuts: KeyboardShortcut[]): void {
    this.batchUpdate(() => {
      shortcuts.forEach(shortcut => this.register(shortcut));
    });
  }

  /**
   * Unregister multiple shortcuts in a single batch update
   * @param ids - Array of shortcut IDs to unregister
   */
  unregisterMany(ids: string[]): void {
    this.batchUpdate(() => {
      ids.forEach(id => this.unregister(id));
    });
  }

  /**
   * Unregister multiple groups in a single batch update
   * @param ids - Array of group IDs to unregister
   */
  unregisterGroups(ids: string[]): void {
    this.batchUpdate(() => {
      ids.forEach(id => this.unregisterGroup(id));
    });
  }

  /**
   * Clear all shortcuts and groups (nuclear reset)
   */
  clearAll(): void {
    this.batchUpdate(() => {
      this.shortcuts.clear();
      this.groups.clear();
      this.activeShortcuts.clear();
      this.activeGroups.clear();
      this.shortcutToGroup.clear();
      this.globalFilters.clear();
      this.clearCurrentlyDownKeys();
      this.clearPendingSequence();
    });
  }

  /**
   * Get all shortcuts belonging to a specific group
   * @param groupId - The group ID
   * @returns Array of shortcuts in the group
   */
  getGroupShortcuts(groupId: string): KeyboardShortcut[] {
    const group = this.groups.get(groupId);
    if (!group) return [];
    
    return [...group.shortcuts];
  }

  /**
   * Normalize a key to lowercase for consistent comparison
   */
  private normalizeKey(key: string): string {
    return key.toLowerCase();
  }

  /**
   * Find the group that contains a specific shortcut.
   * 
   * @param shortcutId - The ID of the shortcut to find
   * @returns The group containing the shortcut, or undefined if not found in any group
   */
  private findGroupForShortcut(shortcutId: string): KeyboardShortcutGroup | undefined {
    const groupId = this.shortcutToGroup.get(shortcutId);
    return groupId ? this.groups.get(groupId) : undefined;
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
    // Note: handleKeydown pre-checks these once per event for early exit,
    // but we keep this for direct calls and completeness.
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

    // Fast path: if any global filter blocks this event, bail out before
    // scanning all active shortcuts. This drastically reduces per-event work
    // when filters are commonly blocking (e.g., while typing in inputs).
    if (this.globalFilters.size > MIN_KEY_LENGTH) {
      for (const f of this.globalFilters.values()) {
        if (!f(event)) {
          // Also clear any pending multi-step sequence – entering a globally
          // filtered context should not allow sequences to continue.
          this.clearPendingSequence();
          return;
        }
      }
    }

    const isMac = this.isMacPlatform();

    // Evaluate active group-level filters once per event and cache blocked groups
    const blockedGroups = this.precomputeBlockedGroups(event);

    // If there is a pending multi-step sequence, try to advance it first
    if (this.pendingSequence) {
      const pending = this.pendingSequence;
      const shortcut = this.shortcuts.get(pending.shortcutId);
      if (shortcut) {
        // If the pending shortcut belongs to a blocked group, cancel sequence
        const g = this.findGroupForShortcut(shortcut.id);
        if (g && blockedGroups.has(g.id)) {
          this.clearPendingSequence();
          return;
        }
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
  // actual modifier/main-key state for this event as a Set<string>.
  const stepPressed = this.getPressedKeys(event);

        if (expected && this.keysMatch(stepPressed, expected)) {
          // Advance sequence
          clearTimeout(pending.timerId);
          pending.stepIndex += STATE_VERSION_INCREMENT;

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

          // Reset timer for next step (only if shortcut has timeout configured)
          if (shortcut.sequenceTimeout !== undefined) {
            pending.timerId = setTimeout(() => { this.pendingSequence = null; }, shortcut.sequenceTimeout);
          }
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

      // Skip expensive matching entirely when the shortcut's group is blocked
      const g = this.findGroupForShortcut(shortcut.id);
      if (g && blockedGroups.has(g.id)) {
        continue;
      }

      const steps = isMac
        ? (shortcut.macSteps ?? shortcut.macKeys ?? shortcut.steps ?? shortcut.keys ?? [])
        : (shortcut.steps ?? shortcut.keys ?? shortcut.macSteps ?? shortcut.macKeys ?? []);
      const normalizedSteps = this.normalizeToSteps(steps as KeyStep[] | string[]);

      const firstStep = normalizedSteps[FIRST_INDEX];

      // Decide which pressed-keys representation to use for this shortcut's
      // expected step: if it requires multiple non-modifier keys, treat it as
      // a chord and use accumulated keys; otherwise use per-event keys to avoid
      // interference from previously pressed non-modifier keys.
  const nonModifierCount = firstStep.filter(k => !KeyMatcher.isModifierKey(k)).length;
      // Normalize pressed keys to a Set<string> for consistent typing
      const pressedForStep: Set<string> = nonModifierCount > MIN_COUNT_ONE
        ? this.buildPressedKeysForMatch(event)
        : this.getPressedKeys(event);

      if (this.keysMatch(pressedForStep, firstStep)) {
        // Check if this event should be processed based on filters
        if (!this.shouldProcessEvent(event, shortcut)) {
          continue; // Skip this shortcut due to filters
        }

        if (normalizedSteps.length === SINGLE_STEP_LENGTH) {
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
          const timerId = shortcut.sequenceTimeout !== undefined
            ? setTimeout(() => { this.pendingSequence = null; }, shortcut.sequenceTimeout)
            : null;
          this.pendingSequence = {
            shortcutId: shortcut.id,
            stepIndex: SECOND_STEP_INDEX,
            timerId
          };
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
    }
  }

  protected handleKeyup(event: KeyboardEvent): void {
    // Remove the key from currently DownKeys on keyup
    const key = event.key ? event.key.toLowerCase() : '';
    if (key && !KeyMatcher.isModifierKey(key)) {
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
    } else if (this.document.visibilityState === 'visible') {
      // When returning to visibility, clear keys to avoid stale state
      // from keys that may have been released while document was hidden
      this.clearCurrentlyDownKeys();
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
    if (KeyMatcher.isModifierKey(key)) {
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

    if (key && key.length > MIN_KEY_LENGTH) {
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
  const nonModifierKeys = Array.from(this.currentlyDownKeys).filter(k => !KeyMatcher.isModifierKey(k));

    const result = new Set<string>();
    // Add modifiers first
    modifiers.forEach(m => result.add(m));

    if (nonModifierKeys.length > MIN_KEY_LENGTH) {
      nonModifierKeys.forEach(k => result.add(k.toLowerCase()));
      return result;
    }

    // Fallback: single main key from the event (existing behavior)
    const key = event.key.toLowerCase();
    if (!KeyMatcher.isModifierKey(key)) {
      result.add(key);
    }
    return result;
  }

  /**
   * Return the pressed keys for this event as a Set<string>.
   * This is the canonical internal API used for matching.
   */
  protected getPressedKeys(event: KeyboardEvent): Set<string> {
    const result = new Set<string>();

    if (event.ctrlKey) result.add('ctrl');
    if (event.altKey) result.add('alt');
    if (event.shiftKey) result.add('shift');
    if (event.metaKey) result.add('meta');

    // Add the main key (normalize to lowercase) if it's not a modifier
    const key = (event.key ?? '').toLowerCase();
    if (key && !KeyMatcher.isModifierKey(key)) {
      result.add(key);
    }

    return result;
  }

  /**
   * Compare pressed keys against a target key combination.
   * Accepts either a Set<string> (preferred) or an array for backwards compatibility.
   * Uses Set-based comparison: sizes must match and every element in target must exist in pressed.
   */
  /**
   * @deprecated Use KeyMatcher.keysMatch() instead
   */
  protected keysMatch(pressedKeys: Set<string> | string[], targetKeys: string[]): boolean {
    return KeyMatcher.keysMatch(pressedKeys, targetKeys);
  }

  /**
   * Compare two multi-step sequences for equality
   * @deprecated Use KeyMatcher.stepsMatch() instead
   */
  protected stepsMatch(a: string[][], b: string[][]): boolean {
    return KeyMatcher.stepsMatch(a, b);
  }

  /** Safely clear any pending multi-step sequence */
  private clearPendingSequence(): void {
    if (!this.pendingSequence) return;
    try {
      // Only clear timeout if one was set
      if (this.pendingSequence.timerId !== null) {
        clearTimeout(this.pendingSequence.timerId);
      }
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
    if (isDestroyRefLike(activeUntil)) {
      activeUntil.onDestroy(unregister);
      return;
    }

    if (activeUntil instanceof Observable) {
      activeUntil.pipe(take(1)).subscribe(unregister);
      return
    }
  }

  /**
   * Evaluate group filters once per event and return the set of blocked group IDs.
   */
  protected precomputeBlockedGroups(event: KeyboardEvent): Set<string> {
    const blocked = new Set<string>();
    if (this.activeGroups.size === MIN_KEY_LENGTH) return blocked;
    for (const groupId of this.activeGroups) {
      const group = this.groups.get(groupId);
      if (group && group.filter && !group.filter(event)) {
        blocked.add(groupId);
      }
    }
    return blocked;
  }
}