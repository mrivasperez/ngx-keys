# NgxKeys

A reactive Angular library for managing keyboard shortcuts with signals-based UI integration.

## Features

- 🎯 **Reactive Signals**: Track active/inactive shortcuts with Angular signals
- 🎨 **UI Integration**: Ready-to-use computed signals for displaying shortcuts
- 📱 **Cross-Platform**: Automatic Mac/PC key display formatting
- 🔄 **Dynamic Management**: Add, remove, activate/deactivate shortcuts at runtime
- 🎚️ **Group Management**: Organize shortcuts into logical groups
- 🧪 **Fully Tested**: Comprehensive test coverage with Angular testing utilities

## Installation

```bash
npm install ngx-keys
```

## Quick Start

### 1. Import the Service

```typescript
import { Component, OnInit } from '@angular/core';
import { KeyboardShortcuts, KeyboardShortcut } from 'ngx-keys';

@Component({
  selector: 'app-example',
  template: `
    <h3>Active Shortcuts ({{ activeShortcuts().length }})</h3>
    <ul>
      @for (shortcut of activeShortcuts(); track shortcut.id) {
        <li>
          <kbd>{{ shortcut.keys }}</kbd> - {{ shortcut.description }}
        </li>
      }
    </ul>
  `
})
export class ExampleComponent implements OnInit {
  // Reactive signal for UI updates
  protected readonly activeShortcuts;

  constructor(private keyboardService: KeyboardShortcuts) {
    this.activeShortcuts = this.keyboardService.activeShortcutsUI;
  }

  ngOnInit() {
    // Register shortcuts
    const shortcuts: KeyboardShortcut[] = [
      {
        id: 'save',
        keys: ['ctrl', 's'],
        macKeys: ['meta', 's'],
        action: () => this.save(),
        description: 'Save document'
      },
      {
        id: 'help',
        keys: ['f1'],
        macKeys: ['f1'],
        action: () => this.showHelp(),
        description: 'Show help'
      }
    ];

    this.keyboardService.registerGroup('main-shortcuts', shortcuts);
  }

  private save() {
    console.log('Document saved!');
  }

  private showHelp() {
    console.log('Help displayed!');
  }
}
```

### 2. Available Signals

The service provides reactive signals for UI integration:

```typescript
// All active shortcuts with formatted keys
activeShortcutsUI: Signal<Array<{id: string, keys: string, macKeys: string, description: string}>>

// All inactive shortcuts
inactiveShortcutsUI: Signal<Array<{id: string, keys: string, macKeys: string, description: string}>>
```

## API Reference

### KeyboardShortcuts Service

#### Methods

- `registerGroup(groupId: string, shortcuts: KeyboardShortcut[])` - Register a group of shortcuts
- `unregisterGroup(groupId: string)` - Remove a group and all its shortcuts
- `activateGroup(groupId: string)` - Activate all shortcuts in a group
- `deactivateGroup(groupId: string)` - Deactivate all shortcuts in a group
- `isGroupActive(groupId: string): boolean` - Check if a group is active
- `activate(shortcutId: string)` - Activate a single shortcut
- `deactivate(shortcutId: string)` - Deactivate a single shortcut

#### Properties

- `activeShortcutsUI: Signal<ShortcutUI[]>` - Reactive signal of active shortcuts for UI
- `inactiveShortcutsUI: Signal<ShortcutUI[]>` - Reactive signal of inactive shortcuts for UI

### KeyboardShortcut Interface

```typescript
interface KeyboardShortcut {
  id: string;           // Unique identifier
  keys: string[];       // Key combination for PC/Linux (e.g., ['ctrl', 's'])
  macKeys: string[];    // Key combination for Mac (e.g., ['meta', 's'])
  action: () => void;   // Function to execute
  description: string;  // Human-readable description
}
```

## Key Mapping Reference

### Modifier Keys

| PC/Linux | Mac | Description |
|----------|-----|-------------|
| `ctrl` | `meta` | Control/Command key |
| `alt` | `alt` | Alt/Option key |
| `shift` | `shift` | Shift key |

### Special Keys

| Key | Value |
|-----|-------|
| Function keys | `f1`, `f2`, `f3`, ... `f12` |
| Arrow keys | `arrowup`, `arrowdown`, `arrowleft`, `arrowright` |
| Navigation | `home`, `end`, `pageup`, `pagedown` |
| Editing | `insert`, `delete`, `backspace` |
| Other | `escape`, `tab`, `enter`, `space` |

## ⚠️ Browser Conflicts Warning

**Important**: Some key combinations conflict with browser defaults. Use these with caution:

### High-Risk Combinations (avoid these)
- `Ctrl+N` / `⌘+N` - New tab/window
- `Ctrl+T` / `⌘+T` - New tab
- `Ctrl+W` / `⌘+W` - Close tab
- `Ctrl+R` / `⌘+R` - Reload page
- `Ctrl+L` / `⌘+L` - Focus address bar
- `Ctrl+D` / `⌘+D` - Bookmark page

### Safer Alternatives
- Function keys: `F1`, `F2`, `F3`, etc.
- Custom combinations: `Ctrl+Shift+S`, `Alt+Enter`
- Arrow keys with modifiers: `Ctrl+ArrowUp`
- Application-specific: `Ctrl+K`, `Ctrl+P` (if not conflicting)

### Testing Browser Conflicts

Always test your shortcuts across different browsers and operating systems. Consider providing alternative key combinations or allow users to customize shortcuts.

## Advanced Usage

### Route-Specific Shortcuts

```typescript
export class FeatureComponent implements OnInit, OnDestroy {
  constructor(private keyboardService: KeyboardShortcuts) {}

  ngOnInit() {
    // Register shortcuts only for this route
    this.keyboardService.registerGroup('feature-shortcuts', [
      {
        id: 'feature-help',
        keys: ['f1'],
        macKeys: ['f1'],
        action: () => this.showFeatureHelp(),
        description: 'Show feature help'
      }
    ]);
  }

  ngOnDestroy() {
    // Clean up when leaving route
    this.keyboardService.unregisterGroup('feature-shortcuts');
  }
}
```

### Dynamic Shortcut Management

```typescript
// Toggle shortcuts based on application state
toggleEditMode() {
  if (this.isEditMode) {
    this.keyboardService.activateGroup('edit-shortcuts');
  } else {
    this.keyboardService.deactivateGroup('edit-shortcuts');
  }
}
```

## Building

To build the library:

```bash
ng build ngx-keys
```

## Testing

To run tests:

```bash
ng test ngx-keys
```

## License

MIT
