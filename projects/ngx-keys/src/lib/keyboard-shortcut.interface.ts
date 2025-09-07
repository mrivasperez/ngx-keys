export interface KeyboardShortcut {
  id: string;
  keys: string[];
  macKeys: string[];
  action: () => void;
  description: string;
}

export interface KeyboardShortcutGroup {
  id: string;
  shortcuts: KeyboardShortcut[];
  active: boolean;
}
