import { KeyboardShortcuts } from './keyboard-shortcuts';
import { KeyboardShortcut } from './keyboard-shortcut.interface';
import { Observable, of } from 'rxjs';
import { DEFAULT_TEST_STEP_DELAY_MS } from './test-constants';

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
  steps?: string[][];
  macSteps?: string[][];
  description?: string;
  action?: () => void;
  activeUntil?: unknown;
  filter?: (event: KeyboardEvent) => boolean;
}

/**
 * NOTE: Tests should interact with the service via the service's public surface only.
// To support zoneless tests we provide DOM event dispatch helpers below so
// tests can simulate keyboard events instead of reaching into protected
// methods. Avoid exporting internal/protected APIs from production code.

/**
 * Dispatches a keyboard event on the document for zoneless tests.
 * The event bubbles and is cancelable by default to match the real events.
 */
export function dispatchKeyEvent(event: KeyboardEvent): void {
  document.dispatchEvent(event);
}

/**
 * Simulate window blur for tests (clears pressed keys and pending sequences).
 */
export function dispatchWindowBlur(): void {
  // Dispatch a blur on window
  try {
    (window as any).dispatchEvent(new Event('blur'));
  } catch {
    // Some test runtimes may not allow dispatching on window; try fallback
    const evt = new Event('blur');
    (globalThis as any).window?.dispatchEvent?.(evt);
  }
}

/**
 * Simulate document visibility change to hidden
 */
export function dispatchVisibilityHidden(): void {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

/**
 * Creates a mock keyboard shortcut with default values
 */
export function createMockShortcut(config: MockShortcutConfig = {}): KeyboardShortcut {
  const defaultAction = config.action || (() => {}); // Default to no-op function

  const shortcut: KeyboardShortcut = {
    id: config.id || 'test-shortcut',
    action: defaultAction,
    description: config.description || 'Test shortcut',
    ...(config.activeUntil !== undefined && { activeUntil: config.activeUntil as any }),
    ...(config.filter !== undefined && { filter: config.filter }),
  };

  // Support both single-step and multi-step shortcuts
  if (config.steps || config.macSteps) {
    // Multi-step shortcut
    if (config.steps) shortcut.steps = config.steps;
    if (config.macSteps) shortcut.macSteps = config.macSteps;
  } else {
    // Single-step shortcut (legacy)
    shortcut.keys = config.keys || ['ctrl', 's'];
    shortcut.macKeys = config.macKeys || ['meta', 's'];
  }

  return shortcut;
}

/**
 * Creates multiple mock shortcuts for group testing
 */
export function createMockShortcuts(
  count: number,
  baseConfig: MockShortcutConfig = {}
): KeyboardShortcut[] {
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
    cancelable: config.cancelable !== false,
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
  allModifiers: (key: string) =>
    createKeyboardEvent({
      key,
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
      metaKey: true,
    }),
  // Multi-step convenience events
  ctrlK: () => createKeyboardEvent({ key: 'k', ctrlKey: true }),
  metaK: () => createKeyboardEvent({ key: 'k', metaKey: true }),
  plain: (key: string) => createKeyboardEvent({ key }),
};

/**
 * Helper function to create a multi-step mock shortcut
 */
export function createMultiStepMockShortcut(config: {
  id?: string;
  steps: string[][];
  macSteps?: string[][];
  action?: () => void;
  description?: string;
}): KeyboardShortcut {
  return createMockShortcut({
    id: config.id,
    steps: config.steps,
    macSteps: config.macSteps || config.steps, // Default to same as steps
    action: config.action,
    description: config.description || 'Multi-step test shortcut',
  });
}

/**
 * Helper to simulate a complete multi-step sequence
 */
export function simulateMultiStepSequence(
  service: KeyboardShortcuts,
  steps: string[][],
  delay: number = DEFAULT_TEST_STEP_DELAY_MS
): void {
  steps.forEach((step, index) => {
    setTimeout(() => {
      const event = createStepEvent(step);
      // Dispatch the event on the document so the service's event listeners
      // (registered in startListening) will receive it in a zoneless-friendly way.
      dispatchKeyEvent(event);
    }, index * delay);
  });
}

/**
 * Helper to create a keyboard event from a step (array of keys)
 */
export function createStepEvent(step: string[]): KeyboardEvent {
  const modifiers = {
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
  };

  let mainKey = '';

  step.forEach((key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'ctrl') modifiers.ctrlKey = true;
    else if (lowerKey === 'alt') modifiers.altKey = true;
    else if (lowerKey === 'shift') modifiers.shiftKey = true;
    else if (lowerKey === 'meta' || lowerKey === 'cmd' || lowerKey === 'command')
      modifiers.metaKey = true;
    else mainKey = key;
  });

  return createKeyboardEvent({
    key: mainKey,
    ...modifiers,
  });
}

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
    this.callbacks.forEach((cb) => cb());
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
  immediateTrigger: (): Observable<boolean> => of(true),
};