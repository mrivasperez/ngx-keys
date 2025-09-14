import { Injectable, OnDestroy, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { KeyboardShortcut, KeyboardShortcutGroup, KeyboardShortcutUI, KeyStep } from './keyboard-shortcut.interface';
import { KeyboardShortcutsErrorFactory } from './keyboard-shortcuts.errors';

@Injectable({
  providedIn: 'root'
})
export class KeyboardShortcuts implements OnDestroy {
  private readonly shortcuts = new Map<string, KeyboardShortcut>();
  private readonly groups = new Map<string, KeyboardShortcutGroup>();
  private readonly activeShortcuts = new Set<string>();
  private readonly activeGroups = new Set<string>();
  
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
  private isListening = false;
  protected isBrowser: boolean;
  /** Default timeout (ms) for completing a multi-step sequence */
  protected sequenceTimeout = 2000;

  /** Runtime state for multi-step sequences */
  private pendingSequence: {
    shortcutId: string;
    stepIndex: number;
    timerId: any;
  } | null = null;

  constructor() {
    // Use try-catch to handle injection context for better testability
    try {
      const platformId = inject(PLATFORM_ID);
      this.isBrowser = isPlatformBrowser(platformId);
    } catch {
      // Fallback for testing - assume browser environment
      this.isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
    }

    if (this.isBrowser) {
      this.startListening();
    }
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
  }

  /**
   * Register multiple keyboard shortcuts as a group
   * @throws KeyboardShortcutError if group ID is already registered or if any shortcut ID or key combination conflicts
   */
  registerGroup(groupId: string, shortcuts: KeyboardShortcut[]): void {
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
        active: true
      };
      
      this.groups.set(groupId, group);
      this.activeGroups.add(groupId);
      
      // Register individual shortcuts
      shortcuts.forEach(shortcut => {
        this.shortcuts.set(shortcut.id, shortcut);
        this.activeShortcuts.add(shortcut.id);
      });
    });
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

  private startListening(): void {
    if (!this.isBrowser || this.isListening) {
      return;
    }
    
    document.addEventListener('keydown', this.keydownListener, { passive: false });
    this.isListening = true;
  }

  private stopListening(): void {
    if (!this.isBrowser || !this.isListening) {
      return;
    }
    
    document.removeEventListener('keydown', this.keydownListener);
    this.isListening = false;
  }

  protected handleKeydown(event: KeyboardEvent): void {
    const pressedKeys = this.getPressedKeys(event);
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

        if (expected && this.keysMatch(pressedKeys, expected)) {
          // Advance sequence
          clearTimeout(pending.timerId);
          pending.stepIndex += 1;

          if (pending.stepIndex >= normalizedSteps.length) {
            // Completed
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
      if (this.keysMatch(pressedKeys, firstStep)) {
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

  protected keysMatch(pressedKeys: string[], targetKeys: string[]): boolean {
    if (pressedKeys.length !== targetKeys.length) {
      return false;
    }
    
    // Normalize and sort both arrays for comparison
    const normalizedPressed = pressedKeys.map(key => key.toLowerCase()).sort();
    const normalizedTarget = targetKeys.map(key => key.toLowerCase()).sort();
    
    return normalizedPressed.every((key, index) => key === normalizedTarget[index]);
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
    return this.isBrowser && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  }
}
