import { Injectable, OnDestroy, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { KeyboardShortcut, KeyboardShortcutGroup, KeyboardShortcutUI } from './keyboard-shortcut.interface';
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
  private readonly keyupListener = this.handleKeyup.bind(this);
  private isListening = false;
  protected isBrowser: boolean;
  // Track currently physically pressed keys (lowercased). This lets us detect chords
  // formed by multiple non-modifier keys (e.g., ['c', 'a']). It is populated by
  // keydown/keyup listeners and used by handleKeydown to build the pressed key set.
  private readonly currentlyDownKeys = new Set<string>();

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
      keys: this.formatKeysForDisplay(shortcut.keys, false),
      macKeys: this.formatKeysForDisplay(shortcut.macKeys, true),
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

  /**
   * Check if a key combination is already registered
   * @returns The ID of the conflicting shortcut, or null if no conflict
   */
  private findConflict(newShortcut: KeyboardShortcut): string | null {
    for (const existing of this.shortcuts.values()) {
      if (this.keysMatch(newShortcut.keys, existing.keys)) {
        return existing.id;
      }
      if (this.keysMatch(newShortcut.macKeys, existing.macKeys)) {
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
    
    // Listen to both keydown and keyup so we can maintain a Set of currently
    // pressed physical keys. We avoid passive:true because we may call
    // preventDefault() when matching shortcuts.
    document.addEventListener('keydown', this.keydownListener, { passive: false });
    document.addEventListener('keyup', this.keyupListener, { passive: false });
    this.isListening = true;
  }

  private stopListening(): void {
    if (!this.isBrowser || !this.isListening) {
      return;
    }
    
    document.removeEventListener('keydown', this.keydownListener);
    document.removeEventListener('keyup', this.keyupListener);
    this.isListening = false;
  }

  protected handleKeydown(event: KeyboardEvent): void {
    // Update the currently down keys with this event's key
    this.updateCurrentlyDownKeysOnKeydown(event);

    // Build the pressed keys set used for matching. Prefer the currentlyDownKeys
    // if it contains more than one non-modifier key; otherwise fall back to the
    // traditional per-event pressed keys calculation for compatibility.
    const pressedKeys = this.buildPressedKeysForMatch(event);
    const isMac = this.isMacPlatform();
    
    for (const shortcutId of this.activeShortcuts) {
      const shortcut = this.shortcuts.get(shortcutId);
      if (!shortcut) continue;
      
      const targetKeys = isMac ? shortcut.macKeys : shortcut.keys;
      
      if (this.keysMatch(pressedKeys, targetKeys)) {
        event.preventDefault();
        event.stopPropagation();
        
        try {
          shortcut.action();
        } catch (error) {
          console.error(`Error executing keyboard shortcut "${shortcut.id}":`, error);
        }
        
        break; // Only execute the first matching shortcut
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
   * Build the pressed keys array used for matching against registered shortcuts.
   * If multiple non-modifier keys are currently down, include them (chord support).
   * Otherwise fall back to single main-key detection from the event for compatibility.
   */
  protected buildPressedKeysForMatch(event: KeyboardEvent): string[] {
    const modifiers: string[] = [];
    if (event.ctrlKey) modifiers.push('ctrl');
    if (event.altKey) modifiers.push('alt');
    if (event.shiftKey) modifiers.push('shift');
    if (event.metaKey) modifiers.push('meta');

    // Collect non-modifier keys from currentlyDownKeys (excluding modifiers)
    const nonModifierKeys = Array.from(this.currentlyDownKeys).filter(k => !['control', 'alt', 'shift', 'meta'].includes(k));

    // If we have at least one non-modifier in the global set, use that set
    // combined with current modifiers. This enables multi-non-modifier chords.
    if (nonModifierKeys.length > 0) {
      return [...modifiers, ...nonModifierKeys.map(k => k.toLowerCase())];
    }

    // Fallback: single main key from the event (existing behavior)
    const key = event.key.toLowerCase();
    const keys: string[] = [...modifiers];
    if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
      keys.push(key);
    }
    return keys;
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

  protected isMacPlatform(): boolean {
    return this.isBrowser && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  }
}
