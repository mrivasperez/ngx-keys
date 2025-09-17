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

### Register and Display Shortcuts
>[!NOTE]
For related shortcuts, use groups for easier management (*[See group management section](#group-management)*).

```typescript
import { Component, DestroyRef, inject } from '@angular/core';
import { KeyboardShortcuts } from 'ngx-keys';

@Component({
  template: `
    <h3>My App</h3>
    <p>Last action: {{ lastAction }}</p>
    
    <h4>Available Shortcuts:</h4>
    @for (shortcut of activeShortcuts(); track shortcut.id) {
      <div>
        <kbd>{{ shortcut.keys }}</kbd> - {{ shortcut.description }}
      </div>
    }
  `
})
export class MyComponent {
  private readonly keyboardService = inject(KeyboardShortcuts);
  private readonly destroyRef = inject(DestroyRef);
  
  protected lastAction = 'Try pressing Ctrl+S or Ctrl+H';
  protected readonly activeShortcuts = () => this.keyboardService.shortcutsUI$().active;

  constructor() {
    // Register individual shortcuts (automatically activated)
    this.keyboardService.register({
      id: 'save',
      keys: ['ctrl', 's'],
      macKeys: ['meta', 's'], 
      action: () => this.save(),
      description: 'Save document'
    });

    this.keyboardService.register({
      id: 'help',
      keys: ['ctrl', 'h'],
      macKeys: ['meta', 'h'],
      action: () => this.showHelp(),
      description: 'Show help'
    });

    // Clean up on component destroy
    this.destroyRef.onDestroy(() => {
      this.keyboardService.unregister('save');
      this.keyboardService.unregister('help');
    });
  }

  private save() {
    this.lastAction = 'Document saved!';
  }

  private showHelp() {
    this.lastAction = 'Help displayed!';
  }
}
```



## Explore the Demo

Want to see ngx-keys in action? Check out our comprehensive [demo application](/projects/demo) with:

| Component                                                                          | Purpose                    | Key Features                                  |
| ---------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------- |
| [**App Component**](/projects/demo/src/app/app.ts)                                 | Global shortcuts           | Single & group registration, cleanup patterns |
| [**Home Component**](/projects/demo/src/app/home/home.component.ts)                | Reactive UI                | Real-time status display, toggle controls     |
| [**Feature Component**](/projects/demo/src/app/feature/feature.component.ts)       | Route-specific shortcuts   | Scoped shortcuts, lifecycle management        |
| [**Customize Component**](/projects/demo/src/app/customize/customize.component.ts) | Dynamic shortcut recording | Real-time key capture, shortcut customization |

**Run the demo:**
```bash
git clone https://github.com/mrivasperez/ngx-keys
cd ngx-keys
npm install
npm start
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

### Multi-step (sequence) shortcuts

In addition to single-step shortcuts using `keys` / `macKeys`, ngx-keys supports ordered multi-step sequences using `steps` and `macSteps` on the `KeyboardShortcut` object. Each element in `steps` is itself an array of key tokens that must be pressed together for that step.

Example: register a sequence that requires `Ctrl+K` followed by `S`:

```typescript
this.keyboardService.register({
  id: 'open-settings-seq',
  steps: [['ctrl', 'k'], ['s']],
  macSteps: [['meta', 'k'], ['s']],
  action: () => this.openSettings(),
  description: 'Open settings (Ctrl+K then S)'
});
```

Important behavior notes:

- Default sequence timeout: the service requires the next step to be entered within 2000ms (2 seconds) of the previous step; otherwise the pending sequence is cleared. This timeout is intentionally conservative and can be changed in future releases or exposed per-shortcut if needed.
- Steps are order-sensitive. `steps: [['ctrl','k'], ['s']]` is different from `steps: [['s'], ['ctrl','k']]`.
- Existing single-step `keys` / `macKeys` remain supported and continue to work as before.


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
  // Single-step combinations (existing API)
  keys?: string[];       // Key combination for PC/Linux (e.g., ['ctrl', 's'])
  macKeys?: string[];    // Key combination for Mac (e.g., ['meta', 's'])

  // Multi-step sequences (new)
  // Each step is an array of keys pressed together. Example: steps: [['ctrl','k'], ['s']]
  steps?: string[][];
  macSteps?: string[][];
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

| PC/Linux | Mac     | Description         |
| -------- | ------- | ------------------- |
| `ctrl`   | `meta`  | Control/Command key |
| `alt`    | `alt`   | Alt/Option key      |
| `shift`  | `shift` | Shift key           |

### Special Keys

| Key           | Value                                             |
| ------------- | ------------------------------------------------- |
| Function keys | `f1`, `f2`, `f3`, ... `f12`                       |
| Arrow keys    | `arrowup`, `arrowdown`, `arrowleft`, `arrowright` |
| Navigation    | `home`, `end`, `pageup`, `pagedown`               |
| Editing       | `insert`, `delete`, `backspace`                   |
| Other         | `escape`, `tab`, `enter`, `space`                 |

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
> [!TIP]
> Always test your shortcuts across different browsers and operating systems. Consider providing alternative key combinations or allow users to customize shortcuts.
- Function keys: `F1`, `F2`, `F3`, etc.
- Custom combinations: `Ctrl+Shift+S`, `Alt+Enter`
- Arrow keys with modifiers: `Ctrl+ArrowUp`
- Application-specific: `Ctrl+K`, `Ctrl+P` (if not conflicting)


## Advanced Usage

> [!TIP]
Check out our [demo application](/projects/demo/src/app) for full implementations of all patterns shown below.

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
  private readonly keyboardService = inject(KeyboardShortcuts);
  
  // Access formatted shortcuts for display
  protected readonly activeShortcuts = () => this.keyboardService.shortcutsUI$().active;
  protected readonly inactiveShortcuts = () => this.keyboardService.shortcutsUI$().inactive;
  protected readonly allShortcuts = () => this.keyboardService.shortcutsUI$().all;
  
  // Access group information
  protected readonly activeGroups = () => this.keyboardService.shortcuts$().groups.active;
  protected readonly inactiveGroups = () => this.keyboardService.shortcuts$().groups.inactive;
}
```
### Group Management

> [!NOTE]
> **Live Example**: See this pattern in action in [feature.component.ts](/projects/demo/src/app/feature/feature.component.ts)

```typescript
import { Component, DestroyRef, inject } from '@angular/core';
import { KeyboardShortcuts, KeyboardShortcut } from 'ngx-keys';

export class FeatureComponent {
  private readonly keyboardService = inject(KeyboardShortcuts);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
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

    // Setup cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.keyboardService.unregisterGroup('edit-shortcuts');
    });
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

### Automatic unregistering

`register` and `registerGroup` have the optional parameter: `activeUntil`. 
The `activeUntil` parameter allows you to connect the shortcut to the wrappers lifecycle or logic in general.  

`activeUntil` supports three types:
- `'destruct'`: the shortcut injects the parents `DestroyRef` and unregisters once the component destructs
- `DestroyRef`: DestroyRef which should trigger the destruction of the shortcut
- `Observable<unknown>`: an Observable which will unregister the shortcut when triggered

#### Example: `'destruct'`
Shortcuts defined by this component will only be listening during the lifecycle of the component.
Shortcuts are registered on construction and are automatically unregistered on destruction.

```typescript
export class Component {
  constructor() {
    const keyboardService = inject(KeyboardShortcuts)

    keyboardService.register({
      // ...
      activeUntil: 'destruct', // alternatively: inject(DestroyRef)
    });

    keyboardService.registerGroup(
      'shortcuts',
      [/* ... */],
      'destruct', // alternatively: inject(DestroyRef)
    );
  }
}
```

#### Example: `Observable`

```typescript
const shortcutTTL = new Subject<void>();

keyboardService.register({
  // ...
  activeUntil: shortcutTTL,
});

keyboardService.registerGroup(
  'shortcuts',
  [/* ... */], 
  shortcutTTL,
);

// Shortcuts are listening...

shortcutTTL.next();

// Shortcuts are unregistered
```

### Batch Operations

For better performance when making multiple changes, use the `batchUpdate` method.

```typescript
import { Component, inject } from '@angular/core';
import { KeyboardShortcuts } from 'ngx-keys';

export class BatchUpdateComponent {
  private readonly keyboardService = inject(KeyboardShortcuts);

  constructor() {
    this.setupMultipleShortcuts();
  }

  private setupMultipleShortcuts() {
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

> [!NOTE]
> See status checking in [home.component.ts](/projects/demo/src/app/home/home.component.ts)

```typescript
import { Component, inject } from '@angular/core';
import { KeyboardShortcuts } from 'ngx-keys';

export class MyComponent {
  private readonly keyboardService = inject(KeyboardShortcuts);

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
