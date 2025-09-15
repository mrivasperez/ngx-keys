import { DestroyRef } from "@angular/core";
import { Observable } from "rxjs";

export type KeyboardShortcutActiveUntil = Observable<unknown> | DestroyRef | 'destruct'

export interface KeyboardShortcut {
  id: string;
  keys: string[];
  macKeys: string[];
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
