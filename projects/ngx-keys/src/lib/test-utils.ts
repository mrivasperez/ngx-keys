import { KeyboardShortcuts } from './keyboard-shortcuts';
import { KeyboardShortcut } from './keyboard-shortcut.interface';
import { Observable, of } from 'rxjs';

/**
 * Test utilities for ngx-keys library testing.
 * Provides common patterns and helpers to reduce boilerplate in tests.
 */

/**
 * Interface for creating keyboard events with common properties
 */
export interface KeyboardEventConfig {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  code?: string;
  bubbles?: boolean;
  cancelable?: boolean;
}

/**
 * Interface for mock shortcut creation
 */
export interface MockShortcutConfig {
  id?: string;
  keys?: string[];
  macKeys?: string[];
  description?: string;
  action?: (() => void);
  activeUntil?: unknown;
}

/**
 * Creates a testable KeyboardShortcuts service instance with exposed protected methods
 */
export class TestableKeyboardShortcuts extends KeyboardShortcuts {
  constructor() {
    super();
    // Override platform detection for testing
    (this as any).isBrowser = true;
    (this as any).isListening = false;
  }

  // Make protected methods public for testing
  public testHandleKeydown = this.handleKeydown.bind(this);
  public testGetPressedKeys = (event: KeyboardEvent) => this.getPressedKeys(event);
  public testKeysMatch = (pressed: string[], target: string[]) => this.keysMatch(pressed, target);
  public testIsMacPlatform = () => this.isMacPlatform();
}

/**
 * Creates a mock keyboard shortcut with default values
 */
export function createMockShortcut(config: MockShortcutConfig = {}): KeyboardShortcut {
  const defaultAction = config.action || (() => {}); // Default to no-op function
  
  return {
    id: config.id || 'test-shortcut',
    keys: config.keys || ['ctrl', 's'],
    macKeys: config.macKeys || ['meta', 's'],
    action: defaultAction,
    description: config.description || 'Test shortcut',
    ...(config.activeUntil !== undefined && { activeUntil: config.activeUntil as any })
  };
}

/**
 * Creates multiple mock shortcuts for group testing
 */
export function createMockShortcuts(count: number, baseConfig: MockShortcutConfig = {}): KeyboardShortcut[] {
  return Array.from({ length: count }, (_, index) => {
    const config = { ...baseConfig };
    if (!config.id) config.id = `shortcut-${index + 1}`;
    if (!config.keys) config.keys = ['ctrl', String.fromCharCode(97 + index)]; // a, b, c, etc.
    if (!config.macKeys) config.macKeys = ['meta', String.fromCharCode(97 + index)];
    if (!config.action) config.action = () => {}; // Default to no-op
    return createMockShortcut(config);
  });
}

/**
 * Creates a keyboard event with the specified configuration
 */
export function createKeyboardEvent(config: KeyboardEventConfig): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key: config.key,
    ctrlKey: config.ctrlKey || false,
    altKey: config.altKey || false,
    shiftKey: config.shiftKey || false,
    metaKey: config.metaKey || false,
    code: config.code,
    bubbles: config.bubbles !== false,
    cancelable: config.cancelable !== false
  });
}

/**
 * Common keyboard event configurations for testing
 */
export const KeyboardEvents = {
  ctrlS: () => createKeyboardEvent({ key: 's', ctrlKey: true }),
  metaS: () => createKeyboardEvent({ key: 's', metaKey: true }),
  ctrlC: () => createKeyboardEvent({ key: 'c', ctrlKey: true }),
  ctrlShiftA: () => createKeyboardEvent({ key: 'a', ctrlKey: true, shiftKey: true }),
  enter: () => createKeyboardEvent({ key: 'Enter' }),
  escape: () => createKeyboardEvent({ key: 'Escape' }),
  f1: () => createKeyboardEvent({ key: 'F1' }),
  allModifiers: (key: string) => createKeyboardEvent({ 
    key, ctrlKey: true, altKey: true, shiftKey: true, metaKey: true 
  })
};

/**
 * Fake DestroyRef for testing activeUntil functionality
 */
export class FakeDestroyRef {
  private callbacks: (() => void)[] = [];

  onDestroy(callback: () => void): void {
    this.callbacks.push(callback);
  }

  /**
   * Triggers all registered destroy callbacks
   */
  trigger(): void {
    this.callbacks.forEach(cb => cb());
    this.callbacks = [];
  }

  /**
   * Returns the number of registered callbacks
   */
  get callbackCount(): number {
    return this.callbacks.length;
  }
}

/**
 * Creates a fake DestroyRef that can be used in tests
 */
export function createFakeDestroyRef(): FakeDestroyRef {
  return new FakeDestroyRef();
}

/**
 * Test service that extends KeyboardShortcuts to override activeUntil handling
 */
export class TestKeyboardShortcutsWithFakeDestruct extends KeyboardShortcuts {
  public fakeDestroyRef = createFakeDestroyRef();

  constructor() {
    super();
    (this as any).isBrowser = true;
    (this as any).isListening = false;
  }

  protected override setupActiveUntil(activeUntil: any, unregister: () => void): void {
    if (activeUntil === 'destruct') {
      this.fakeDestroyRef.onDestroy(unregister);
      return;
    }
    return super.setupActiveUntil(activeUntil, unregister);
  }
}

/**
 * Observable helpers for testing activeUntil with observables
 */
export const TestObservables = {
  /**
   * Creates an observable that emits immediately (synchronous)
   */
  immediate: <T>(value: T): Observable<T> => of(value),
  
  /**
   * Creates an observable that emits true immediately
   */
  immediateTrigger: (): Observable<boolean> => of(true)
};

/**
 * Non-browser environment test service
 */
export class NonBrowserKeyboardShortcuts extends KeyboardShortcuts {
  constructor() {
    super();
    (this as any).isBrowser = false;
  }
}