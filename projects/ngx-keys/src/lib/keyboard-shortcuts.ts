import { Injectable, OnDestroy, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { KeyboardShortcut, KeyboardShortcutGroup, KeyboardShortcutUI } from './keyboard-shortcut.interface';

@Injectable({
  providedIn: 'root'
})
export class KeyboardShortcuts implements OnDestroy {
  private readonly shortcuts = new Map<string, KeyboardShortcut>();
  private readonly groups = new Map<string, KeyboardShortcutGroup>();
  private readonly activeShortcuts = new Set<string>();
  private readonly activeGroups = new Set<string>();
  
  // Reactive signals for UI updates
  private readonly shortcutsSignal = signal<Map<string, KeyboardShortcut>>(new Map());
  private readonly groupsSignal = signal<Map<string, KeyboardShortcutGroup>>(new Map());
  private readonly activeShortcutsSignal = signal<Set<string>>(new Set());
  private readonly activeGroupsSignal = signal<Set<string>>(new Set());
  
  // Computed signals for performant UI access
  readonly activeShortcutsUI = computed<KeyboardShortcutUI[]>(() => {
    const shortcuts = this.shortcutsSignal();
    const activeIds = this.activeShortcutsSignal();
    
    return Array.from(activeIds)
      .map(id => shortcuts.get(id))
      .filter((shortcut): shortcut is KeyboardShortcut => shortcut !== undefined)
      .map(shortcut => ({
        id: shortcut.id,
        keys: this.formatKeysForDisplay(shortcut.keys, false),
        macKeys: this.formatKeysForDisplay(shortcut.macKeys, true),
        description: shortcut.description
      }));
  });
  
  readonly inactiveShortcutsUI = computed<KeyboardShortcutUI[]>(() => {
    const shortcuts = this.shortcutsSignal();
    const activeIds = this.activeShortcutsSignal();
    
    return Array.from(shortcuts.values())
      .filter(shortcut => !activeIds.has(shortcut.id))
      .map(shortcut => ({
        id: shortcut.id,
        keys: this.formatKeysForDisplay(shortcut.keys, false),
        macKeys: this.formatKeysForDisplay(shortcut.macKeys, true),
        description: shortcut.description
      }));
  });
  
  readonly allShortcutsUI = computed<KeyboardShortcutUI[]>(() => {
    const shortcuts = this.shortcutsSignal();
    
    return Array.from(shortcuts.values())
      .map(shortcut => ({
        id: shortcut.id,
        keys: this.formatKeysForDisplay(shortcut.keys, false),
        macKeys: this.formatKeysForDisplay(shortcut.macKeys, true),
        description: shortcut.description
      }));
  });  readonly activeGroupIds = computed<string[]>(() => {
    return Array.from(this.activeGroupsSignal());
  });
  
  readonly inactiveGroupIds = computed<string[]>(() => {
    const groups = this.groupsSignal();
    const activeIds = this.activeGroupsSignal();
    
    return Array.from(groups.keys())
      .filter(id => !activeIds.has(id));
  });
  
  private readonly keydownListener = this.handleKeydown.bind(this);
  private isListening = false;
  protected isBrowser: boolean;

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
   * Update all signals to reflect current state
   */
  private updateSignals(): void {
    this.shortcutsSignal.set(new Map(this.shortcuts));
    this.groupsSignal.set(new Map(this.groups));
    this.activeShortcutsSignal.set(new Set(this.activeShortcuts));
    this.activeGroupsSignal.set(new Set(this.activeGroups));
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
   * Register a single keyboard shortcut
   * @throws Error if shortcut ID is already registered
   */
  register(shortcut: KeyboardShortcut): void {
    if (this.shortcuts.has(shortcut.id)) {
      throw new Error(`Keyboard shortcut with ID "${shortcut.id}" is already registered. Use a unique ID or unregister the existing shortcut first.`);
    }
    
    this.shortcuts.set(shortcut.id, shortcut);
    this.activeShortcuts.add(shortcut.id);
    this.updateSignals();
  }

  /**
   * Register multiple keyboard shortcuts as a group
   * @throws Error if group ID is already registered or if any shortcut ID conflicts
   */
  registerGroup(groupId: string, shortcuts: KeyboardShortcut[]): void {
    // Check if group ID already exists
    if (this.groups.has(groupId)) {
      throw new Error(`Keyboard shortcut group with ID "${groupId}" is already registered. Use a unique group ID or unregister the existing group first.`);
    }
    
    // Check for duplicate shortcut IDs
    const duplicateIds: string[] = [];
    shortcuts.forEach(shortcut => {
      if (this.shortcuts.has(shortcut.id)) {
        duplicateIds.push(shortcut.id);
      }
    });
    
    if (duplicateIds.length > 0) {
      throw new Error(`Cannot register group "${groupId}": The following shortcut IDs are already registered: ${duplicateIds.join(', ')}. Use unique IDs or unregister the existing shortcuts first.`);
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
      throw new Error(`Cannot register group "${groupId}": Duplicate shortcut IDs found within the group: ${duplicatesInGroup.join(', ')}. Each shortcut must have a unique ID.`);
    }
    
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
    
    this.updateSignals();
  }

  /**
   * Safely register a single keyboard shortcut without throwing errors
   * @returns true if registration was successful, false if shortcut ID already exists
   */
  tryRegister(shortcut: KeyboardShortcut): boolean {
    if (this.shortcuts.has(shortcut.id)) {
      return false;
    }
    
    this.shortcuts.set(shortcut.id, shortcut);
    this.activeShortcuts.add(shortcut.id);
    this.updateSignals();
    return true;
  }

  /**
   * Safely register multiple keyboard shortcuts as a group without throwing errors
   * @returns Object with success status and details about any conflicts
   */
  tryRegisterGroup(groupId: string, shortcuts: KeyboardShortcut[]): { 
    success: boolean; 
    conflicts: { groupExists?: boolean; duplicateShortcuts?: string[]; duplicatesInGroup?: string[] }
  } {
    const conflicts: any = {};
    
    // Check if group ID already exists
    if (this.groups.has(groupId)) {
      conflicts.groupExists = true;
    }
    
    // Check for duplicate shortcut IDs
    const duplicateIds: string[] = [];
    shortcuts.forEach(shortcut => {
      if (this.shortcuts.has(shortcut.id)) {
        duplicateIds.push(shortcut.id);
      }
    });
    
    if (duplicateIds.length > 0) {
      conflicts.duplicateShortcuts = duplicateIds;
    }
    
    // Check for duplicates within the group
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
      conflicts.duplicatesInGroup = duplicatesInGroup;
    }
    
    // If any conflicts, return false
    if (Object.keys(conflicts).length > 0) {
      return { success: false, conflicts };
    }
    
    // Register the group
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
    
    this.updateSignals();
    return { success: true, conflicts: {} };
  }

  /**
   * Unregister a single keyboard shortcut
   * @throws Error if shortcut ID doesn't exist
   */
  unregister(shortcutId: string): void {
    if (!this.shortcuts.has(shortcutId)) {
      throw new Error(`Cannot unregister: Keyboard shortcut with ID "${shortcutId}" is not registered.`);
    }
    
    this.shortcuts.delete(shortcutId);
    this.activeShortcuts.delete(shortcutId);
    this.updateSignals();
  }

  /**
   * Unregister a group of keyboard shortcuts
   * @throws Error if group ID doesn't exist
   */
  unregisterGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Cannot unregister: Keyboard shortcut group with ID "${groupId}" is not registered.`);
    }
    
    group.shortcuts.forEach(shortcut => {
      this.shortcuts.delete(shortcut.id);
      this.activeShortcuts.delete(shortcut.id);
    });
    this.groups.delete(groupId);
    this.activeGroups.delete(groupId);
    this.updateSignals();
  }

  /**
   * Activate a single keyboard shortcut
   * @throws Error if shortcut ID doesn't exist
   */
  activate(shortcutId: string): void {
    if (!this.shortcuts.has(shortcutId)) {
      throw new Error(`Cannot activate: Keyboard shortcut with ID "${shortcutId}" is not registered.`);
    }
    
    this.activeShortcuts.add(shortcutId);
    this.updateSignals();
  }

  /**
   * Deactivate a single keyboard shortcut
   * @throws Error if shortcut ID doesn't exist
   */
  deactivate(shortcutId: string): void {
    if (!this.shortcuts.has(shortcutId)) {
      throw new Error(`Cannot deactivate: Keyboard shortcut with ID "${shortcutId}" is not registered.`);
    }
    
    this.activeShortcuts.delete(shortcutId);
    this.updateSignals();
  }

  /**
   * Activate a group of keyboard shortcuts
   * @throws Error if group ID doesn't exist
   */
  activateGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Cannot activate: Keyboard shortcut group with ID "${groupId}" is not registered.`);
    }
    
    group.active = true;
    this.activeGroups.add(groupId);
    group.shortcuts.forEach(shortcut => {
      this.activeShortcuts.add(shortcut.id);
    });
    this.updateSignals();
  }

  /**
   * Deactivate a group of keyboard shortcuts
   * @throws Error if group ID doesn't exist
   */
  deactivateGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Cannot deactivate: Keyboard shortcut group with ID "${groupId}" is not registered.`);
    }
    
    group.active = false;
    this.activeGroups.delete(groupId);
    group.shortcuts.forEach(shortcut => {
      this.activeShortcuts.delete(shortcut.id);
    });
    this.updateSignals();
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
