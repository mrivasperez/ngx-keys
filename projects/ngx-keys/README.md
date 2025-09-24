# ngx-keys

A lightweight, reactive Angular service for managing keyboard shortcuts with signals-based UI integration.

## Features

- **🎯 Service-Focused**: Clean, focused API without unnecessary UI components
- **⚡ Reactive Signals**: Track active/inactive shortcuts with Angular signals
- **🔧 UI-Agnostic**: Build your own UI using the provided reactive signals
- **🌍 Cross-Platform**: Automatic Mac/PC key display formatting
- **🔄 Dynamic Management**: Add, remove, activate/deactivate shortcuts at runtime
- **📁 Group Management**: Organize shortcuts into logical groups
- **� Smart Conflict Detection**: Register multiple shortcuts with same keys when not simultaneously active
- **�🪶 Lightweight**: Zero dependencies, minimal bundle impact

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

### Smart Conflict Detection
> [!IMPORTANT]
Conflicts are only checked among **active** shortcuts, not all registered shortcuts.

ngx-keys allows registering multiple shortcuts with the same key combination, as long as they're not simultaneously active. This enables powerful patterns:

- **Context-specific shortcuts**: Same keys for different UI contexts
- **Alternative shortcuts**: Multiple ways to trigger the same action 
- **Feature toggles**: Same keys for different modes

```typescript
// Basic conflict handling
this.keyboardService.register(shortcut1); // Active by default
this.keyboardService.deactivate('shortcut1'); 
this.keyboardService.register(shortcut2); // Same keys, but shortcut1 is inactive ✅

// This would fail - conflicts with active shortcut2
// this.keyboardService.activate('shortcut1'); // ❌ Throws error
```

### Group Management

Organize related shortcuts into groups for easier management:

```typescript
const editorShortcuts = [
  {
    id: 'bold',
    keys: ['ctrl', 'b'],
    macKeys: ['meta', 'b'],
    action: () => this.makeBold(),
    description: 'Make text bold'
  },
  {
    id: 'italic', 
    keys: ['ctrl', 'i'],
    macKeys: ['meta', 'i'],
    action: () => this.makeItalic(),
    description: 'Make text italic'
  }
];

// Register all shortcuts in the group
this.keyboardService.registerGroup('editor', editorShortcuts);

// Control the entire group
this.keyboardService.deactivateGroup('editor'); // Disable all editor shortcuts
this.keyboardService.activateGroup('editor');   // Re-enable all editor shortcuts
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

**Important behavior notes**

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

## Advanced Usage

### Context-Specific Shortcuts

Register different actions for the same keys in different UI contexts:

```typescript
// Modal context
this.keyboardService.register({
  id: 'modal-escape',
  keys: ['escape'],
  action: () => this.closeModal(),
  description: 'Close modal'
});

// Initially deactivate since modal isn't shown
this.keyboardService.deactivate('modal-escape');

// Editor context  
this.keyboardService.register({
  id: 'editor-escape',
  keys: ['escape'], // Same key, different context
  action: () => this.exitEditMode(),
  description: 'Exit edit mode'
});

// Switch contexts dynamically
showModal() {
  this.keyboardService.deactivate('editor-escape');
  this.keyboardService.activate('modal-escape');
}

hideModal() {
  this.keyboardService.deactivate('modal-escape');
  this.keyboardService.activate('editor-escape');
}
```

### Alternative Shortcuts

Provide multiple ways to trigger the same functionality:

```typescript
// Primary shortcut
this.keyboardService.register({
  id: 'help-f1',
  keys: ['f1'],
  action: () => this.showHelp(),
  description: 'Show help (F1)'
});

// Alternative shortcut - different keys, same action
this.keyboardService.register({
  id: 'help-ctrl-h',
  keys: ['ctrl', 'h'],
  action: () => this.showHelp(), // Same action
  description: 'Show help (Ctrl+H)'
});

// Both are active simultaneously since they don't conflict
```

### Feature Toggles

Switch between different modes that use the same keys:

```typescript
// Design mode
this.keyboardService.register({
  id: 'design-mode-space',
  keys: ['space'],
  action: () => this.toggleDesignElement(),
  description: 'Toggle design element'
});

// Play mode (same key, different action)
this.keyboardService.register({
  id: 'play-mode-space',
  keys: ['space'],
  action: () => this.pausePlayback(),
  description: 'Pause/resume playback'
});

// Initially deactivate play mode
this.keyboardService.deactivate('play-mode-space');

// Switch modes
switchToPlayMode() {
  this.keyboardService.deactivate('design-mode-space');
  this.keyboardService.activate('play-mode-space');
}

switchToDesignMode() {
  this.keyboardService.deactivate('play-mode-space');
  this.keyboardService.activate('design-mode-space');
}
```

### Advanced Group Patterns

Use groups for complex activation/deactivation scenarios:

```typescript
// Create context-specific groups
const modalShortcuts = [
  { id: 'modal-close', keys: ['escape'], action: () => this.closeModal(), description: 'Close modal' },
  { id: 'modal-confirm', keys: ['enter'], action: () => this.confirmModal(), description: 'Confirm' }
];

const editorShortcuts = [
  { id: 'editor-save', keys: ['ctrl', 's'], action: () => this.save(), description: 'Save' },
  { id: 'editor-undo', keys: ['ctrl', 'z'], action: () => this.undo(), description: 'Undo' }
];

// Register both groups
this.keyboardService.registerGroup('modal', modalShortcuts);
this.keyboardService.registerGroup('editor', editorShortcuts);

// Initially only editor is active
this.keyboardService.deactivateGroup('modal');

// Switch contexts
showModal() {
  this.keyboardService.deactivateGroup('editor');
  this.keyboardService.activateGroup('modal');
}

hideModal() {
  this.keyboardService.deactivateGroup('modal');
  this.keyboardService.activateGroup('editor');
}
```

### Conflict Detection Rules

- **Registration**: Only checks conflicts with currently **active** shortcuts
- **Activation**: Throws error if activating would conflict with other active shortcuts
- **Groups**: Same rules apply - groups can contain conflicting shortcuts as long as they're not simultaneously active

```typescript
// ✅ This works - shortcuts with same keys but only one active at a time
this.keyboardService.register(shortcut1); // Active by default
this.keyboardService.deactivate('shortcut1'); 
this.keyboardService.register(shortcut2); // Same keys, but shortcut1 is inactive

// ❌ This fails - trying to activate would create conflict
this.keyboardService.activate('shortcut1'); // Throws error - conflicts with active shortcut2
```

## API Reference

### KeyboardShortcuts Service

#### Methods

**Registration Methods:**
> [!TIP]
Conflicts are only checked among **active** shortcuts, not all registered shortcuts.

- `register(shortcut: KeyboardShortcut)` - Register and automatically activate a single shortcut *Throws error on conflicts with active shortcuts only*
- `registerGroup(groupId: string, shortcuts: KeyboardShortcut[])` - Register and automatically activate a group of shortcuts *Throws error on conflicts with active shortcuts only*

**Management Methods:**
- `unregister(shortcutId: string)` - Remove a shortcut *Throws error if not found*
- `unregisterGroup(groupId: string)` - Remove a group *Throws error if not found*
- `activate(shortcutId: string)` - Activate a shortcut *Throws error if not registered or would create conflicts*
- `deactivate(shortcutId: string)` - Deactivate a shortcut *Throws error if not registered*
- `activateGroup(groupId: string)` - Activate all shortcuts in a group *Throws error if not found or would create conflicts*
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

### Chords (multiple non-modifier keys)

- ngx-keys supports chords composed of multiple non-modifier keys pressed simultaneously (for example `C + A`).
- When multiple non-modifier keys are physically held down at the same time, the service uses the set of currently pressed keys plus any modifier flags to match registered shortcuts.
- Example: register a chord with `keys: ['c','a']` and pressing and holding `c` then pressing `a` will trigger the shortcut.
- Note: Browsers deliver separate keydown events for each physical key; the library maintains a Set of currently-down keys via `keydown`/`keyup` listeners to enable chords. This approach attempts to be robust but can be affected by browser focus changes — ensure tests in your target browsers.

Example registration:

```typescript
this.keyboardService.register({
  id: 'chord-ca',
  keys: ['c', 'a'],
  macKeys: ['c', 'a'],
  action: () => console.log('Chord C+A executed'),
  description: 'Demo chord'
});
```

### Event Filtering

You can configure which keyboard events should be processed by setting a filter function. This is useful for ignoring shortcuts when users are typing in input fields, text areas, or other form elements.

> [!NOTE]
> **No Default Filtering**: ngx-keys processes ALL keyboard events by default. This gives you maximum flexibility - some apps want shortcuts to work everywhere, others want to exclude form inputs. You decide!

#### Named filters (recommended)

For efficiency and control, prefer named global filters. You can toggle them on/off without replacing others, and ngx-keys evaluates them only once per keydown event (fast path), short‑circuiting further work when blocked.

```typescript
// Add named filters
keyboardService.addFilter('forms', (event) => {
  const t = event.target as HTMLElement | null;
  const tag = t?.tagName?.toLowerCase();
  return !(['input', 'textarea', 'select'].includes(tag ?? '')) && !t?.isContentEditable;
});

keyboardService.addFilter('modal-scope', (event) => {
  const t = event.target as HTMLElement | null;
  return !!t?.closest('.modal');
});

// Remove/toggle when context changes
keyboardService.removeFilter('modal-scope');

// Inspect and manage
keyboardService.getFilterNames(); // ['forms']
keyboardService.clearFilters();   // remove all
```

```typescript
import { Component, inject } from '@angular/core';
import { KeyboardShortcuts, KeyboardShortcutFilter } from 'ngx-keys';

export class FilterExampleComponent {
  private readonly keyboardService = inject(KeyboardShortcuts);

  constructor() {
    // Set up shortcuts
    this.keyboardService.register({
      id: 'save',
      keys: ['ctrl', 's'],
      macKeys: ['meta', 's'],
      action: () => this.save(),
      description: 'Save document'
    });

    // Configure filtering to ignore form elements
    this.setupInputFiltering();
  }

  private setupInputFiltering() {
    const inputFilter: KeyboardShortcutFilter = (event) => {
      const target = event.target as HTMLElement;
      const tagName = target?.tagName?.toLowerCase();
      return !['input', 'textarea', 'select'].includes(tagName) && !target?.isContentEditable;
    };

    // Use named filter for toggling
    this.keyboardService.addFilter('forms', inputFilter);
  }

  private save() {
    console.log('Document saved!');
  }
}
```

#### Common Filter Patterns

**Ignore form elements:**
```typescript
const formFilter: KeyboardShortcutFilter = (event) => {
  const target = event.target as HTMLElement;
  const tagName = target?.tagName?.toLowerCase();
  return !['input', 'textarea', 'select'].includes(tagName) && !target?.isContentEditable;
};

keyboardService.addFilter('forms', formFilter);
```

**Ignore elements with specific attributes:**
```typescript
const attributeFilter: KeyboardShortcutFilter = (event) => {
  const target = event.target as HTMLElement;
  return !target?.hasAttribute('data-no-shortcuts');
};

keyboardService.addFilter('no-shortcuts-attr', attributeFilter);
```

**Complex conditional filtering:**
```typescript
const conditionalFilter: KeyboardShortcutFilter = (event) => {
  const target = event.target as HTMLElement;
  
  // Allow shortcuts in code editors (even though they're contentEditable)
  if (target?.classList?.contains('code-editor')) {
    return true;
  }
  
  // Block shortcuts in form elements
  if (target?.tagName?.match(/INPUT|TEXTAREA|SELECT/i) || target?.isContentEditable) {
    return false;
  }
  
  return true;
};

keyboardService.addFilter('conditional', conditionalFilter);
```

**Remove filtering:**
```typescript
// Remove a specific named filter
keyboardService.removeFilter('forms');
// Or remove all
keyboardService.clearFilters();
```

#### Example: Modal Context Filtering

```typescript
export class ModalComponent {
  constructor() {
    // When modal opens, only allow modal-specific shortcuts
    this.keyboardService.addFilter('modal-scope', (event) => {
      const target = event.target as HTMLElement;
      
      // Only process events within the modal
      return target?.closest('.modal') !== null;
    });
  }

  onClose() {
    // Restore normal filtering when modal closes
    this.keyboardService.removeFilter('modal-scope');
  }
}
```

#### Performance tips

- Filters are evaluated once per keydown before scanning shortcuts. If any global filter returns false, ngx-keys exits early and clears pending sequences.
- Group-level filters are precomputed once per event; shortcuts in blocked groups are skipped without key matching.
- Keep filters cheap and synchronous. Prefer reading event.target properties (tagName, isContentEditable, classList) over layout-triggering queries.
- Use named filters to toggle contexts (modals, editors) without allocating new closures per interaction.
- Avoid complex DOM traversals inside filters; if needed, memoize simple queries or use attributes (e.g., data-no-shortcuts).

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
