# ngx-keys

A lightweight, reactive Angular service for managing keyboard shortcuts with signals-based UI integration.

## Features

- **🎯 Service-Focused**: Clean, focused API without unnecessary UI components
- **⚡ Reactive Signals**: Track active/inactive shortcuts with Angular signals
- **🔧 UI-Agnostic**: Build your own UI using the provided reactive signals
- **🌍 Cross-Platform**: Automatic Mac/PC key display formatting
- **🔄 Dynamic Management**: Add, remove, activate/deactivate shortcuts at runtime
- **📁 Group Management**: Organize shortcuts into logical groups
- **🪶 Lightweight**: Zero dependencies, minimal bundle impact

## Installation

```bash
npm install ngx-keys
```

## Quick Start
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
  protected activeShortcuts = () => this.keyboardService.shortcutsUI$().active;
}
```
## Key Concepts

### Automatic Activation

> [!IMPORTANT]
> When you register shortcuts using `register()` or `registerGroup()`, they are **automatically activated** and ready to use immediately. You don't need to call `activate()` unless you've previously deactivated them.

```typescript
// This shortcut is immediately active after registration
this.keyboardService.register({
  id: 'save',
  keys: ['ctrl', 's'],
  macKeys: ['meta', 's'],
  action: () => this.save(),
  description: 'Save document'
});
```

Use the `activate()` and `deactivate()` methods for dynamic control after registration:

```typescript
// Temporarily disable a shortcut
this.keyboardService.deactivate('save');

// Re-enable it later
this.keyboardService.activate('save');
```

## API Reference

### KeyboardShortcuts Service

#### Methods

**Registration Methods:**
- `register(shortcut: KeyboardShortcut)` - Register and automatically activate a single shortcut *Throws error on conflicts*
- `registerGroup(groupId: string, shortcuts: KeyboardShortcut[])` - Register and automatically activate a group of shortcuts *Throws error on conflicts*

**Management Methods:**
- `unregister(shortcutId: string)` - Remove a shortcut *Throws error if not found*
- `unregisterGroup(groupId: string)` - Remove a group *Throws error if not found*
- `activate(shortcutId: string)` - Activate a shortcut *Throws error if not registered*
- `deactivate(shortcutId: string)` - Deactivate a shortcut *Throws error if not registered*
- `activateGroup(groupId: string)` - Activate all shortcuts in a group *Throws error if not found*
- `deactivateGroup(groupId: string)` - Deactivate all shortcuts in a group *Throws error if not found*

**Query Methods:**
- `isActive(shortcutId: string): boolean` - Check if a shortcut is active
- `isRegistered(shortcutId: string): boolean` - Check if a shortcut is registered
- `isGroupActive(groupId: string): boolean` - Check if a group is active
- `isGroupRegistered(groupId: string): boolean` - Check if a group is registered
- `getShortcuts(): ReadonlyMap<string, KeyboardShortcut>` - Get all registered shortcuts
- `getGroups(): ReadonlyMap<string, KeyboardShortcutGroup>` - Get all registered groups

**Utility Methods:**
- `formatShortcutForUI(shortcut: KeyboardShortcut): KeyboardShortcutUI` - Format a shortcut for display
- `batchUpdate(operations: () => void): void` - Batch multiple operations to reduce signal updates

#### Reactive Signals

The service provides reactive signals for UI integration:

```typescript
// Primary signal containing all shortcut state
shortcuts$: Signal<{
  active: KeyboardShortcut[];
  inactive: KeyboardShortcut[];
  all: KeyboardShortcut[];
  groups: {
    active: string[];
    inactive: string[];
  };
}>

// Pre-formatted UI signal for easy display
shortcutsUI$: Signal<{
  active: ShortcutUI[];
  inactive: ShortcutUI[];
  all: ShortcutUI[];
}>
```

**ShortcutUI Interface:**
```typescript
interface KeyboardShortcutUI {
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

## Browser Conflicts Warning

> [!WARNING]
> Some key combinations conflict with browser defaults. Use these with caution:

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

> [!TIP]
> Always test your shortcuts across different browsers and operating systems. Consider providing alternative key combinations or allow users to customize shortcuts.

## Advanced Usage

### Reactive UI Integration

```typescript
import { Component, inject } from '@angular/core';
import { KeyboardShortcuts } from 'ngx-keys';

@Component({
  template: `
    <section>
      <h3>Active Shortcuts ({{ activeShortcuts().length }})</h3>
      @for (shortcut of activeShortcuts(); track shortcut.id) {
        <div>
          <kbd>{{ shortcut.keys }}</kbd> - {{ shortcut.description }}
        </div>
      }
    </section>

    <section>
      <h3>Active Groups</h3>
      @for (groupId of activeGroups(); track groupId) {
        <div>{{ groupId }}</div>
      }
    </section>
  `
})
export class ShortcutsDisplayComponent {
  private keyboardService = inject(KeyboardShortcuts);
  
  // Access formatted shortcuts for display
  protected activeShortcuts = () => this.keyboardService.shortcutsUI$().active;
  protected inactiveShortcuts = () => this.keyboardService.shortcutsUI$().inactive;
  protected allShortcuts = () => this.keyboardService.shortcutsUI$().all;
  
  // Access group information
  protected activeGroups = () => this.keyboardService.shortcuts$().groups.active;
  protected inactiveGroups = () => this.keyboardService.shortcuts$().groups.inactive;
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
      },
      {
        id: 'copy',
        keys: ['ctrl', 'c'],
        macKeys: ['meta', 'c'],
        action: () => this.copy(),
        description: 'Copy selection'
      }
    ];

    // Group is automatically activated when registered
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
  private copy() { /* implementation */ }
}
```

### Batch Operations

For better performance when making multiple changes, use the `batchUpdate` method:

```typescript
import { Component, inject } from '@angular/core';
import { KeyboardShortcuts } from 'ngx-keys';

export class BatchUpdateComponent {
  private keyboardService = inject(KeyboardShortcuts);

  setupMultipleShortcuts() {
    // Batch multiple operations to reduce signal updates
    // Note: Shortcuts are automatically activated when registered
    this.keyboardService.batchUpdate(() => {
      this.keyboardService.register({
        id: 'action1',
        keys: ['ctrl', '1'],
        macKeys: ['meta', '1'],
        action: () => this.action1(),
        description: 'Action 1'
      });

      this.keyboardService.register({
        id: 'action2',
        keys: ['ctrl', '2'],
        macKeys: ['meta', '2'],
        action: () => this.action2(),
        description: 'Action 2'
      });
    });
  }

  private action1() { /* implementation */ }
  private action2() { /* implementation */ }
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

0BSD © [ngx-keys Contributors](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
