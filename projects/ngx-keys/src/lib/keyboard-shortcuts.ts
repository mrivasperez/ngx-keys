import { Injectable, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { KeyboardShortcut, KeyboardShortcutGroup } from './keyboard-shortcut.interface';

@Injectable({
  providedIn: 'root'
})
export class KeyboardShortcuts implements OnDestroy {
  private readonly shortcuts = new Map<string, KeyboardShortcut>();
  private readonly groups = new Map<string, KeyboardShortcutGroup>();
  private readonly activeShortcuts = new Set<string>();
  private readonly activeGroups = new Set<string>();
  
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
   * Register a single keyboard shortcut
   */
  register(shortcut: KeyboardShortcut): void {
    this.shortcuts.set(shortcut.id, shortcut);
    this.activeShortcuts.add(shortcut.id);
  }

  /**
   * Register multiple keyboard shortcuts as a group
   */
  registerGroup(groupId: string, shortcuts: KeyboardShortcut[]): void {
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
  }

  /**
   * Unregister a single keyboard shortcut
   */
  unregister(shortcutId: string): void {
    this.shortcuts.delete(shortcutId);
    this.activeShortcuts.delete(shortcutId);
  }

  /**
   * Unregister a group of keyboard shortcuts
   */
  unregisterGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (group) {
      group.shortcuts.forEach(shortcut => {
        this.shortcuts.delete(shortcut.id);
        this.activeShortcuts.delete(shortcut.id);
      });
      this.groups.delete(groupId);
      this.activeGroups.delete(groupId);
    }
  }

  /**
   * Activate a single keyboard shortcut
   */
  activate(shortcutId: string): void {
    if (this.shortcuts.has(shortcutId)) {
      this.activeShortcuts.add(shortcutId);
    }
  }

  /**
   * Deactivate a single keyboard shortcut
   */
  deactivate(shortcutId: string): void {
    this.activeShortcuts.delete(shortcutId);
  }

  /**
   * Activate a group of keyboard shortcuts
   */
  activateGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (group) {
      group.active = true;
      this.activeGroups.add(groupId);
      group.shortcuts.forEach(shortcut => {
        this.activeShortcuts.add(shortcut.id);
      });
    }
  }

  /**
   * Deactivate a group of keyboard shortcuts
   */
  deactivateGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (group) {
      group.active = false;
      this.activeGroups.delete(groupId);
      group.shortcuts.forEach(shortcut => {
        this.activeShortcuts.delete(shortcut.id);
      });
    }
  }

  /**
   * Check if a shortcut is active
   */
  isActive(shortcutId: string): boolean {
    return this.activeShortcuts.has(shortcutId);
  }

  /**
   * Check if a group is active
   */
  isGroupActive(groupId: string): boolean {
    return this.activeGroups.has(groupId);
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
