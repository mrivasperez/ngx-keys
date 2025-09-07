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

### Basic Usage

```typescript
import { Component, OnInit, inject } from '@angular/core';
import { KeyboardShortcuts, KeyboardShortcut } from 'ngx-keys';

@Component({
  selector: 'app-example',
  template: `
    <p>Press Ctrl+S to save, F1 for help</p>
    <p>Active shortcuts: {{ activeShortcuts().length }}</p>
  `
})
export class ExampleComponent implements OnInit {
  private keyboardService = inject(KeyboardShortcuts);
  protected activeShortcuts = this.keyboardService.activeShortcutsUI;

  ngOnInit() {
    this.keyboardService.register({
      id: 'save',
      keys: ['ctrl', 's'],
      macKeys: ['meta', 's'],
      action: () => this.save(),
      description: 'Save document'
    });

    this.keyboardService.register({
      id: 'help',
      keys: ['f1'],
      macKeys: ['f1'],
      action: () => this.showHelp(),
      description: 'Show help'
    });
  }

  private save() {
    console.log('Document saved!');
  }

  private showHelp() {
    console.log('Help displayed!');
  }
}
```

### Displaying Shortcuts

```typescript
import { Component, inject } from '@angular/core';
import { KeyboardShortcuts } from 'ngx-keys';

@Component({
  template: `
    @for (shortcut of activeShortcuts(); track shortcut.id) {
      <div>
        <kbd>{{ shortcut.keys }}</kbd> - {{ shortcut.description }}
      </div>
    }
  `
})
export class ShortcutsComponent {
  private keyboardService = inject(KeyboardShortcuts);
  protected activeShortcuts = this.keyboardService.activeShortcutsUI;
}
```
## API Reference

### KeyboardShortcuts Service

#### Methods

**Registration Methods:**
- `register(shortcut: KeyboardShortcut)` - Register a single shortcut ⚠️ *Throws error on conflicts*
- `registerGroup(groupId: string, shortcuts: KeyboardShortcut[])` - Register a group of shortcuts ⚠️ *Throws error on conflicts*
- `tryRegister(shortcut: KeyboardShortcut)` - Safe registration, returns `{success: boolean, conflicts: object}`
- `tryRegisterGroup(groupId: string, shortcuts: KeyboardShortcut[])` - Safe group registration with detailed conflict info

**Management Methods:**
- `unregister(shortcutId: string)` - Remove a shortcut ⚠️ *Throws error if not found*
- `unregisterGroup(groupId: string)` - Remove a group ⚠️ *Throws error if not found*
- `activate(shortcutId: string)` - Activate a shortcut ⚠️ *Throws error if not registered*
- `deactivate(shortcutId: string)` - Deactivate a shortcut ⚠️ *Throws error if not registered*
- `activateGroup(groupId: string)` - Activate all shortcuts in a group ⚠️ *Throws error if not found*
- `deactivateGroup(groupId: string)` - Deactivate all shortcuts in a group ⚠️ *Throws error if not found*

**Query Methods:**
- `isActive(shortcutId: string): boolean` - Check if a shortcut is active
- `isRegistered(shortcutId: string): boolean` - Check if a shortcut is registered
- `isGroupActive(groupId: string): boolean` - Check if a group is active
- `isGroupRegistered(groupId: string): boolean` - Check if a group is registered
- `getShortcuts(): ReadonlyMap<string, KeyboardShortcut>` - Get all registered shortcuts
- `getGroups(): ReadonlyMap<string, KeyboardShortcutGroup>` - Get all registered groups

#### Reactive Signals

The service provides reactive signals for UI integration:

```typescript
// All active shortcuts with formatted keys for display
activeShortcutsUI: Signal<ShortcutUI[]>

// All inactive shortcuts with formatted keys for display  
inactiveShortcutsUI: Signal<ShortcutUI[]>

// Combined view of all registered shortcuts
allShortcutsUI: Signal<ShortcutUI[]>

// Active and inactive group IDs
activeGroupIds: Signal<string[]>
inactiveGroupIds: Signal<string[]>
```

**ShortcutUI Interface:**
```typescript
interface ShortcutUI {
  id: string;           // Shortcut identifier
  keys: string;         // Formatted PC/Linux keys (e.g., "Ctrl+S")
  macKeys: string;      // Formatted Mac keys (e.g., "⌘+S")
  description: string;  // Human-readable description
}
```

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

### KeyboardShortcutGroup Interface

```typescript
interface KeyboardShortcutGroup {
  id: string;                     // Unique group identifier
  shortcuts: KeyboardShortcut[];  // Array of shortcuts in this group
  active: boolean;                // Whether the group is currently active
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

### Safe Registration

```typescript
import { inject } from '@angular/core';
import { KeyboardShortcuts } from 'ngx-keys';

// In a component or service
export class MyComponent {
  private keyboardService = inject(KeyboardShortcuts);

  registerSaveShortcut() {
    const result = this.keyboardService.tryRegister({
      id: 'save',
      keys: ['ctrl', 's'],
      macKeys: ['meta', 's'],
      action: () => this.save(),
      description: 'Save document'
    });

    if (!result.success) {
      console.log('Registration failed:', result.conflicts);
    }
  }

  private save() {
    // Implementation
  }
}
```

### Group Management

```typescript
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { KeyboardShortcuts, KeyboardShortcut } from 'ngx-keys';

export class FeatureComponent implements OnInit, OnDestroy {
  private keyboardService = inject(KeyboardShortcuts);

  ngOnInit() {
    const shortcuts: KeyboardShortcut[] = [
      {
        id: 'cut',
        keys: ['ctrl', 'x'],
        macKeys: ['meta', 'x'],
        action: () => this.cut(),
        description: 'Cut selection'
      }
    ];

    this.keyboardService.registerGroup('edit-shortcuts', shortcuts);
  }

  ngOnDestroy() {
    this.keyboardService.unregisterGroup('edit-shortcuts');
  }

  toggleEditMode(enabled: boolean) {
    if (enabled) {
      this.keyboardService.activateGroup('edit-shortcuts');
    } else {
      this.keyboardService.deactivateGroup('edit-shortcuts');
    }
  }

  private cut() { /* implementation */ }
}
```

### Checking Status

```typescript
import { inject } from '@angular/core';
import { KeyboardShortcuts } from 'ngx-keys';

export class MyComponent {
  private keyboardService = inject(KeyboardShortcuts);

  checkAndActivate() {
    // Check before performing operations
    if (this.keyboardService.isRegistered('my-shortcut')) {
      this.keyboardService.activate('my-shortcut');
    }

    if (this.keyboardService.isGroupRegistered('my-group')) {
      this.keyboardService.activateGroup('my-group');
    }
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

MIT © [NgxKeys Contributors](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
