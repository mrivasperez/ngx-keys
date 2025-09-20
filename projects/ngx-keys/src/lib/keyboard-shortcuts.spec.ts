import { KeyboardShortcuts } from './keyboard-shortcuts';
import { KeyboardShortcut } from './keyboard-shortcut.interface';
import { KeyboardShortcutsErrors } from './keyboard-shortcuts.errors';
import * as ngCore from '@angular/core';
import { of } from 'rxjs';
import {
  TestableKeyboardShortcuts,
  createMockShortcut,
  createMockShortcuts,
  createKeyboardEvent,
  KeyboardEvents,
  TestKeyboardShortcutsWithFakeDestruct,
  TestObservables,
  createMultiStepMockShortcut,
  DestructGroupService,
} from './test-utils';
import { TestBed } from '@angular/core/testing';

describe('KeyboardShortcuts', () => {
  let service: TestableKeyboardShortcuts;
  let mockAction: jasmine.Spy;

  // Keep the original mockShortcut for backwards compatibility during refactoring
  const mockShortcut: KeyboardShortcut = {
    id: 'test-shortcut',
    keys: ['ctrl', 's'],
    macKeys: ['meta', 's'],
    action: () => { },
    description: 'Test shortcut'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ngCore.provideZonelessChangeDetection(),
        TestableKeyboardShortcuts,
        TestKeyboardShortcutsWithFakeDestruct,
        DestructGroupService,
      ],
    });
    service = TestBed.inject(TestableKeyboardShortcuts);
    mockAction = jasmine.createSpy('mockAction');
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Reactive Signals', () => {
    it('should provide reactive signals for UI', () => {
      expect(service.shortcuts$).toBeDefined();
      expect(service.shortcutsUI$).toBeDefined();
    });

    it('should update shortcuts$ signal when shortcuts are registered', () => {
      const initialCount = service.shortcuts$().active.length;

      const shortcut = { ...mockShortcut, action: mockAction };
      service.register(shortcut);

      expect(service.shortcuts$().active.length).toBe(initialCount + 1);
      expect(service.shortcutsUI$().active[0]).toEqual({
        id: 'test-shortcut',
        keys: 'Ctrl+S',
        macKeys: '⌘+S',
        description: 'Test shortcut'
      });
    });

    it('should update shortcuts$ signal when shortcuts are deactivated', () => {
      const shortcut = { ...mockShortcut, action: mockAction };
      service.register(shortcut);
      service.deactivate('test-shortcut');

      expect(service.shortcuts$().inactive.length).toBe(1);
      expect(service.shortcuts$().inactive[0].id).toBe('test-shortcut');
      expect(service.shortcuts$().active.length).toBe(0);
    });

    it('should update shortcuts$ signal with all registered shortcuts', () => {
      const shortcut1 = { ...mockShortcut, id: 'shortcut-1', action: mockAction };
      const shortcut2 = { ...mockShortcut, id: 'shortcut-2', keys: ['ctrl', 'c'], macKeys: ['meta', 'c'], action: mockAction };

      service.register(shortcut1);
      service.register(shortcut2);

      expect(service.shortcuts$().all.length).toBe(2);
      expect(service.shortcuts$().all.map(s => s.id)).toContain('shortcut-1');
      expect(service.shortcuts$().all.map(s => s.id)).toContain('shortcut-2');
    });

    it('should update group signals', () => {
      const shortcuts = [
        { ...mockShortcut, id: 'shortcut-1', action: mockAction }
      ];

      service.registerGroup('test-group', shortcuts);
      expect(service.shortcuts$().groups.active).toContain('test-group');
      expect(service.shortcuts$().groups.inactive).not.toContain('test-group');

      service.deactivateGroup('test-group');
      expect(service.shortcuts$().groups.active).not.toContain('test-group');
      expect(service.shortcuts$().groups.inactive).toContain('test-group');
    });
  });

  describe('Single Shortcut Management', () => {
    it('should register a single shortcut', () => {
      const shortcut = createMockShortcut({ action: mockAction });
      service.register(shortcut);

      expect(service.getShortcuts().has('test-shortcut')).toBe(true);
      expect(service.isActive('test-shortcut')).toBe(true);
    });

    it('should unregister a single shortcut', () => {
      const shortcut = createMockShortcut({ action: mockAction });
      service.register(shortcut);
      service.unregister('test-shortcut');

      expect(service.getShortcuts().has('test-shortcut')).toBe(false);
      expect(service.isActive('test-shortcut')).toBe(false);
    });

    it('should activate and deactivate individual shortcuts', () => {
      const shortcut = createMockShortcut({ action: mockAction });
      service.register(shortcut);

      service.deactivate('test-shortcut');
      expect(service.isActive('test-shortcut')).toBe(false);

      service.activate('test-shortcut');
      expect(service.isActive('test-shortcut')).toBe(true);
    });

    it('should throw error when activating non-existent shortcuts', () => {
      expect(() => service.activate('non-existent')).toThrowError(
        KeyboardShortcutsErrors.CANNOT_ACTIVATE_SHORTCUT('non-existent')
      );
    });

    it('should throw error when deactivating non-existent shortcuts', () => {
      expect(() => service.deactivate('non-existent')).toThrowError(
        KeyboardShortcutsErrors.CANNOT_DEACTIVATE_SHORTCUT('non-existent')
      );
    });

    describe('activeUntil cleanup', () => {
      it('should handle undefined activeUntil gracefully', () => {
        const mockAction = jasmine.createSpy('mockAction');

        const shortcut: KeyboardShortcut = {
          id: 'no-activeuntil-test',
          keys: ['f3'],
          macKeys: ['f3'],
          action: mockAction,
          description: 'Test no activeUntil',
          activeUntil: undefined
        };

        expect(() => service.register(shortcut)).not.toThrow();
        expect(service.isRegistered('no-activeuntil-test')).toBe(true);
      });

      it('should unregister when activeUntil is "destruct" by using an overridden setupActiveUntil', () => {
        const mockAction = jasmine.createSpy('mockAction');
        const localService = TestBed.inject(TestKeyboardShortcutsWithFakeDestruct);

        const shortcut = createMockShortcut({
          id: 'destruct-test',
          keys: ['f4'],
          macKeys: ['f4'],
          action: mockAction,
          description: 'Test destruct',
          activeUntil: 'destruct'
        });

        localService.register(shortcut);
        expect(localService.isRegistered('destruct-test')).toBe(true);

        // Trigger destruction using the utility's fake DestroyRef
        localService.fakeDestroyRef.trigger();
        expect(localService.isRegistered('destruct-test')).toBe(false);
      });

      it('should unregister when activeUntil is a DestroyRef instance', () => {
        const mockAction = jasmine.createSpy('mockAction');

        // Try to extend the real DestroyRef if available, otherwise fallback to a compatible fake
        const RealDestroyRef: any = (ngCore as any).DestroyRef || null;

        let instance: any;
        if (RealDestroyRef) {
          class LocalFake extends RealDestroyRef {
            private cb: (() => void) | null = null;
            onDestroy(fn: () => void) { this.cb = fn; }
            trigger() { if (this.cb) this.cb(); }
          }
          instance = new LocalFake();
        } else {
          // Fallback: use a plain object that will still match the instanceof check in some environments
          instance = {
            cb: null as any,
            onDestroy(fn: () => void) { this.cb = fn; },
            trigger() { if (this.cb) this.cb(); }
          };
          // Try to set prototype to mimic DestroyRef if available
          if ((ngCore as any).DestroyRef && (ngCore as any).DestroyRef.prototype) {
            Object.setPrototypeOf(instance, (ngCore as any).DestroyRef.prototype);
          }
        }

        const shortcut: KeyboardShortcut = {
          id: 'destroyref-instance-test',
          keys: ['f5'],
          macKeys: ['f5'],
          action: mockAction,
          description: 'Test destroyref instance',
          activeUntil: instance
        } as any;

        service.register(shortcut);
        expect(service.isRegistered('destroyref-instance-test')).toBe(true);

        // Trigger the stored callback
        instance.trigger();
        expect(service.isRegistered('destroyref-instance-test')).toBe(false);
      });

      it('should unregister when observable emits', () => {
        const mockAction = jasmine.createSpy('mockAction');
        const obs = TestObservables.immediateTrigger();

        const shortcut = createMockShortcut({
          id: 'observable-test',
          keys: ['f6'],
          macKeys: ['f6'],
          action: mockAction,
          description: 'Test observable',
          activeUntil: obs
        });

        service.register(shortcut);
        // Observable emits synchronously so the shortcut should have been unregistered
        expect(service.isRegistered('observable-test')).toBe(false);
      });
    });
  });

  describe('Group Management', () => {
    it('should register a group of shortcuts', () => {
      const shortcuts = createMockShortcuts(2, { action: mockAction });
      // Update the second shortcut to use different keys
      shortcuts[1].keys = ['ctrl', 'c'];
      shortcuts[1].macKeys = ['meta', 'c'];

      service.registerGroup('test-group', shortcuts);

      expect(service.getGroups().has('test-group')).toBe(true);
      expect(service.isGroupActive('test-group')).toBe(true);
      expect(service.isActive('shortcut-1')).toBe(true);
      expect(service.isActive('shortcut-2')).toBe(true);
    });

    it('should unregister a group of shortcuts', () => {
      const shortcuts = createMockShortcuts(2, { action: mockAction });
      shortcuts[1].keys = ['ctrl', 'c'];
      shortcuts[1].macKeys = ['meta', 'c'];

      service.registerGroup('test-group', shortcuts);
      service.unregisterGroup('test-group');

      expect(service.getGroups().has('test-group')).toBe(false);
      expect(service.isGroupActive('test-group')).toBe(false);
      expect(service.isActive('shortcut-1')).toBe(false);
      expect(service.isActive('shortcut-2')).toBe(false);
    });

    it('should activate and deactivate groups', () => {
      const shortcuts = createMockShortcuts(2, { action: mockAction });
      shortcuts[1].keys = ['ctrl', 'c'];
      shortcuts[1].macKeys = ['meta', 'c'];

      service.registerGroup('test-group', shortcuts);

      service.deactivateGroup('test-group');
      expect(service.isGroupActive('test-group')).toBe(false);
      expect(service.isActive('shortcut-1')).toBe(false);
      expect(service.isActive('shortcut-2')).toBe(false);

      service.activateGroup('test-group');
      expect(service.isGroupActive('test-group')).toBe(true);
      expect(service.isActive('shortcut-1')).toBe(true);
      expect(service.isActive('shortcut-2')).toBe(true);
    });

    it('should throw error when activating non-existent groups', () => {
      expect(() => service.activateGroup('non-existent')).toThrowError(
        KeyboardShortcutsErrors.CANNOT_ACTIVATE_GROUP('non-existent')
      );
    });

    it('should throw error when deactivating non-existent groups', () => {
      expect(() => service.deactivateGroup('non-existent')).toThrowError(
        KeyboardShortcutsErrors.CANNOT_DEACTIVATE_GROUP('non-existent')
      );
    });

    it('should throw error when unregistering non-existent groups', () => {
      expect(() => service.unregisterGroup('non-existent')).toThrowError(
        KeyboardShortcutsErrors.CANNOT_UNREGISTER_GROUP('non-existent')
      );
    });

    describe('activeUntil cleanup', () => {
      it('should handle undefined activeUntil gracefully for groups', () => {
        const mockAction = jasmine.createSpy('mockAction');

        const shortcuts = [
          {
            id: 'group-no-activeuntil-1',
            keys: ['f7'],
            macKeys: ['f7'],
            action: mockAction,
            description: 'Test'
          }
        ];

        expect(() => service.registerGroup('group-no-activeuntil', shortcuts)).not.toThrow();
        expect(service.isGroupRegistered('group-no-activeuntil')).toBe(true);
      });

      it('should unregister group when activeUntil is "destruct" by using an overridden setupActiveUntil', () => {
        const mockAction = jasmine.createSpy('mockAction');
        const localService = TestBed.inject(DestructGroupService);

        const shortcuts = [
          {
            id: 'group-destruct-1',
            keys: ['f8'],
            macKeys: ['f8'],
            action: mockAction,
            description: 'Test'
          }
        ];

        localService.registerGroup('group-destruct', shortcuts, 'destruct' as any);
        expect(localService.isGroupRegistered('group-destruct')).toBe(true);

        localService.fakeRef.trigger();
        expect(localService.isGroupRegistered('group-destruct')).toBe(false);
      });

      it('should unregister group when activeUntil is a DestroyRef instance', () => {
        const mockAction = jasmine.createSpy('mockAction');

        const RealDestroyRef: any = (ngCore as any).DestroyRef || null;
        let instance: any;
        if (RealDestroyRef) {
          class LocalFake extends RealDestroyRef {
            private cb: (() => void) | null = null;
            onDestroy(fn: () => void) { this.cb = fn; }
            trigger() { if (this.cb) this.cb(); }
          }
          instance = new LocalFake();
        } else {
          instance = {
            cb: null as any,
            onDestroy(fn: () => void) { this.cb = fn; },
            trigger() { if (this.cb) this.cb(); }
          };
          if ((ngCore as any).DestroyRef && (ngCore as any).DestroyRef.prototype) {
            Object.setPrototypeOf(instance, (ngCore as any).DestroyRef.prototype);
          }
        }

        const shortcuts = [
          {
            id: 'group-dref-1',
            keys: ['f9'],
            macKeys: ['f9'],
            action: mockAction,
            description: 'Test'
          }
        ];

        service.registerGroup('group-dref', shortcuts, instance);
        expect(service.isGroupRegistered('group-dref')).toBe(true);

        instance.trigger();
        expect(service.isGroupRegistered('group-dref')).toBe(false);
      });

      it('should unregister group when observable emits', () => {
        const mockAction = jasmine.createSpy('mockAction');
        const obs = of(true);

        const shortcuts = [
          {
            id: 'group-obs-1',
            keys: ['f10'],
            macKeys: ['f10'],
            action: mockAction,
            description: 'Test'
          }
        ];

        service.registerGroup('group-obs', shortcuts, obs as any);
        // of(true) emits synchronously so the group should have been unregistered
        expect(service.isGroupRegistered('group-obs')).toBe(false);
      });
    });
  });

  describe('Key Formatting', () => {
    it('should format PC keys with proper separators', () => {
      const shortcut = {
        ...mockShortcut,
        keys: ['ctrl', 'shift', 'a'],
        macKeys: ['meta', 'shift', 'a'],
        action: mockAction
      };
      service.register(shortcut);

      const formatted = service.shortcutsUI$().all[0];
      expect(formatted.keys).toBe('Ctrl+Shift+A');
    });

    it('should format Mac keys with Unicode symbols', () => {
      const shortcut = {
        ...mockShortcut,
        keys: ['ctrl', 'alt', 'shift', 'a'],
        macKeys: ['meta', 'alt', 'shift', 'a'],
        action: mockAction
      };
      service.register(shortcut);

      const formatted = service.shortcutsUI$().all[0];
      expect(formatted.macKeys).toBe('⌘+⌥+⇧+A');
    });

    it('should handle unknown modifier keys', () => {
      const shortcut = {
        ...mockShortcut,
        keys: ['unknown', 'x'],
        macKeys: ['unknown', 'x'],
        action: mockAction
      };
      service.register(shortcut);

      const formatted = service.shortcutsUI$().all[0];
      expect(formatted.keys).toBe('UNKNOWN+X');
      expect(formatted.macKeys).toBe('UNKNOWN+X');
    });

    it('should handle cmd and command keys on Mac', () => {
      const shortcut1 = {
        ...mockShortcut,
        id: 'cmd-test',
        keys: ['cmd', 's'],
        macKeys: ['cmd', 's'],
        action: mockAction
      };
      const shortcut2 = {
        ...mockShortcut,
        id: 'command-test',
        keys: ['command', 'c'],
        macKeys: ['command', 'c'],
        action: mockAction
      };

      service.register(shortcut1);
      service.register(shortcut2);

      const formatted = service.shortcutsUI$().all;
      expect(formatted.find((s: any) => s.id === 'cmd-test')?.macKeys).toBe('⌘+S');
      expect(formatted.find((s: any) => s.id === 'command-test')?.macKeys).toBe('⌘+C');
    });
  });

  describe('Key Matching Logic', () => {

    it('should correctly parse pressed keys from keyboard event', () => {
      const event = KeyboardEvents.ctrlS();

      const pressedKeys = service.testGetPressedKeys(event);
      expect(pressedKeys).toEqual(['ctrl', 's']);
    });

    it('should detect and match a chord of two non-modifier keys', () => {
      // Register a chord shortcut using our utility
      const chordAction = jasmine.createSpy('chordAction');
      service.register(createMockShortcut({
        id: 'chord-ca',
        keys: ['c', 'a'],
        macKeys: ['c', 'a'],
        action: chordAction,
        description: 'Chord C+A'
      }));

      // Simulate keydown for 'c' using our utility
      const eventC = createKeyboardEvent({ key: 'c' });
      service.testHandleKeydown(eventC);

      // Simulate keydown for 'a' while 'c' is still down
      const eventA = createKeyboardEvent({ key: 'a' });
      service.testHandleKeydown(eventA);

      // The chord action should have been executed when the second key was pressed
      expect(chordAction).toHaveBeenCalled();
    });

    it('should not falsely match chord when only one key is pressed', () => {
      const chordAction = jasmine.createSpy('chordAction2');
      service.register(createMockShortcut({
        id: 'chord-xy',
        keys: ['x', 'y'],
        macKeys: ['x', 'y'],
        action: chordAction,
        description: 'Chord X+Y'
      }));

      const eventX = createKeyboardEvent({ key: 'x' });
      service.testHandleKeydown(eventX);

      // Only one key down - should not trigger
      expect(chordAction).not.toHaveBeenCalled();
    });

    it('should clear currently-down keys and prevent stale chord matches', () => {
      const chordAction = jasmine.createSpy('chordActionClear');
      service.register(createMockShortcut({
        id: 'chord-clear',
        keys: ['m', 'n'],
        macKeys: ['m', 'n'],
        action: chordAction,
        description: 'Chord M+N'
      }));

      // Simulate m down using our utility
      const eventM = createKeyboardEvent({ key: 'm' });
      service.testHandleKeydown(eventM);

      // Now simulate window blur/visibility change by calling the clear method
      service.clearCurrentlyDownKeys();

      // Simulate n down — chord should not trigger because the state was cleared
      const eventN = createKeyboardEvent({ key: 'n' });
      service.testHandleKeydown(eventN);

      expect(chordAction).not.toHaveBeenCalled();
    });

    it('should handle chord with three non-modifier keys', () => {
      const chordAction = jasmine.createSpy('tripleChordAction');
      service.register(createMockShortcut({
        id: 'chord-abc',
        keys: ['a', 'b', 'c'],
        macKeys: ['a', 'b', 'c'],
        action: chordAction,
        description: 'Chord A+B+C'
      }));

      // Press all three keys in sequence
      service.testHandleKeydown(createKeyboardEvent({ key: 'a' }));
      service.testHandleKeydown(createKeyboardEvent({ key: 'b' }));
      service.testHandleKeydown(createKeyboardEvent({ key: 'c' }));

      expect(chordAction).toHaveBeenCalled();
    });

    it('should handle chord with modifiers and non-modifier keys combined', () => {
      const chordAction = jasmine.createSpy('modifierChordAction');
      service.register(createMockShortcut({
        id: 'chord-ctrl-ab',
        keys: ['ctrl', 'a', 'b'],
        macKeys: ['meta', 'a', 'b'],
        action: chordAction,
        description: 'Chord Ctrl+A+B'
      }));

      // Press ctrl, then a, then b
      service.testHandleKeydown(createKeyboardEvent({ key: 'a', ctrlKey: true }));
      service.testHandleKeydown(createKeyboardEvent({ key: 'b', ctrlKey: true }));

      expect(chordAction).toHaveBeenCalled();
    });

    it('should not trigger chord when keys are pressed in wrong combination', () => {
      const chordAction = jasmine.createSpy('wrongOrderAction');
      service.register(createMockShortcut({
        id: 'chord-precise',
        keys: ['p', 'q'],
        macKeys: ['p', 'q'],
        action: chordAction,
        description: 'Chord P+Q'
      }));

      // Press only p, then release without pressing q
      service.testHandleKeydown(createKeyboardEvent({ key: 'p' }));
      // Simulate some other key being pressed instead
      service.testHandleKeydown(createKeyboardEvent({ key: 'r' }));

      expect(chordAction).not.toHaveBeenCalled();
    });

    it('should handle multiple different chords without interference', () => {
      const chordAction1 = jasmine.createSpy('chord1Action');
      const chordAction2 = jasmine.createSpy('chord2Action');

      service.register(createMockShortcut({
        id: 'chord-first',
        keys: ['j', 'k'],
        macKeys: ['j', 'k'],
        action: chordAction1,
        description: 'Chord J+K'
      }));

      service.register(createMockShortcut({
        id: 'chord-second',
        keys: ['l', 'm'],
        macKeys: ['l', 'm'],
        action: chordAction2,
        description: 'Chord L+M'
      }));

      // Trigger first chord
      service.testHandleKeydown(createKeyboardEvent({ key: 'j' }));
      service.testHandleKeydown(createKeyboardEvent({ key: 'k' }));

      expect(chordAction1).toHaveBeenCalled();
      expect(chordAction2).not.toHaveBeenCalled();

      // Clear currently pressed keys to ensure clean state for second chord
      service.clearCurrentlyDownKeys();

      // Reset spy calls and trigger second chord
      chordAction1.calls.reset();
      chordAction2.calls.reset();

      service.testHandleKeydown(createKeyboardEvent({ key: 'l' }));
      service.testHandleKeydown(createKeyboardEvent({ key: 'm' }));

      expect(chordAction1).not.toHaveBeenCalled();
      expect(chordAction2).toHaveBeenCalled();
    });

    it('should parse multiple modifier keys', () => {
      const event = KeyboardEvents.allModifiers('a');

      const pressedKeys = service.testGetPressedKeys(event);
      expect(pressedKeys).toEqual(['ctrl', 'alt', 'shift', 'meta', 'a']);
    });

    it('should ignore modifier keys as main key', () => {
      const event = createKeyboardEvent({
        ctrlKey: true,
        key: 'control'
      });

      const pressedKeys = service.testGetPressedKeys(event);
      expect(pressedKeys).toEqual(['ctrl']);
    });

    it('should handle special keys', () => {
      const event = KeyboardEvents.enter();

      const pressedKeys = service.testGetPressedKeys(event);
      expect(pressedKeys).toEqual(['enter']);
    });

    it('should match keys correctly', () => {
      const pressedKeys = ['ctrl', 's'];
      const targetKeys = ['ctrl', 's'];

      expect(service.testKeysMatch(pressedKeys, targetKeys)).toBe(true);
    });

    it('should not match different key combinations', () => {
      const pressedKeys = ['ctrl', 's'];
      const targetKeys = ['ctrl', 'c'];

      expect(service.testKeysMatch(pressedKeys, targetKeys)).toBe(false);
    });

    it('should not match different lengths', () => {
      const pressedKeys = ['ctrl', 's'];
      const targetKeys = ['ctrl', 'shift', 's'];

      expect(service.testKeysMatch(pressedKeys, targetKeys)).toBe(false);
    });

    it('should handle case insensitive key matching', () => {
      const pressedKeys = ['ctrl', 'S'];
      const targetKeys = ['ctrl', 's'];

      expect(service.testKeysMatch(pressedKeys, targetKeys)).toBe(true);
    });

    it('should match keys regardless of order', () => {
      const pressedKeys = ['s', 'ctrl'];
      const targetKeys = ['ctrl', 's'];

      expect(service.testKeysMatch(pressedKeys, targetKeys)).toBe(true);
    });
  });

  describe('Keyboard Event Handling', () => {
    it('should execute shortcut action when matching keys are pressed', () => {
      const shortcut = createMockShortcut({ action: mockAction });
      service.register(shortcut);

      const event = KeyboardEvents.ctrlS();
      service.testHandleKeydown(event);
      expect(mockAction).toHaveBeenCalled();
    });

    it('should use Mac keys on Mac platform', () => {
      const macAction = jasmine.createSpy('macAction');
      const shortcut = createMockShortcut({
        keys: ['ctrl', 's'],
        macKeys: ['meta', 's'],
        action: macAction
      });
      service.register(shortcut);

      // Mock the platform detection check
      spyOn(service, 'testIsMacPlatform').and.returnValue(true);
      // Override the isMacPlatform method call in handleKeydown
      spyOn(service as any, 'isMacPlatform').and.returnValue(true);

      const event = KeyboardEvents.metaS();
      service.testHandleKeydown(event);
      expect(macAction).toHaveBeenCalled();
    });

    it('should not execute action for inactive shortcuts', () => {
      const shortcut = { ...mockShortcut, action: mockAction };
      service.register(shortcut);
      service.deactivate('test-shortcut');

      const testableService = service as any;
      const event = new KeyboardEvent('keydown', {
        ctrlKey: true,
        key: 's'
      });

      testableService.testHandleKeydown(event);
      expect(mockAction).not.toHaveBeenCalled();
    });

    it('should only execute first matching shortcut', () => {
      const action1 = jasmine.createSpy('action1');
      const action2 = jasmine.createSpy('action2');

      service.register({ ...mockShortcut, id: 'shortcut-1', keys: ['ctrl', 'x'], macKeys: ['meta', 'x'], action: action1 });
      service.register({ ...mockShortcut, id: 'shortcut-2', keys: ['ctrl', 'y'], macKeys: ['meta', 'y'], action: action2 });

      const testableService = service as any;
      const event = new KeyboardEvent('keydown', {
        ctrlKey: true,
        key: 'x'
      });

      testableService.testHandleKeydown(event);
      expect(action1).toHaveBeenCalled();
      expect(action2).not.toHaveBeenCalled();
    });

    it('should not execute multi-step shortcut if timeout occurs before next step', (done) => {
      const multiAction = jasmine.createSpy('multiActionTimeout');
      const shortcut = {
        id: 'multi-2',
        steps: [['ctrl', 'k'], ['s']],
        macSteps: [['meta', 'k'], ['s']],
        action: multiAction,
        description: 'Multi-step timeout'
      } as any as KeyboardShortcut;

      service.register(shortcut);
      const testableService = service as any;

      // First step
      const event1 = new KeyboardEvent('keydown', { ctrlKey: true, key: 'k' });
      testableService.testHandleKeydown(event1);

      // Wait longer than default sequenceTimeout (2s)
      setTimeout(() => {
        const event2 = new KeyboardEvent('keydown', { key: 's' });
        testableService.testHandleKeydown(event2);
        expect(multiAction).not.toHaveBeenCalled();
        done();
      }, 2200);
    });
  });

  describe('Multi-step Shortcuts', () => {
    it('should execute multi-step shortcut when steps are entered in sequence', (done) => {
      const action = jasmine.createSpy('multiStepAction');
      const shortcut = createMultiStepMockShortcut({
        id: 'multi-step-test',
        // Use a two-step sequence: ctrl+k, then plain 's' for reliability in tests
        steps: [['ctrl', 'k'], ['s']],
        action,
      });

      service.register(shortcut);

      // Simulate the first step (ctrl+k)
      service.testHandleKeydown(KeyboardEvents.ctrlK());

      // Simulate the second step shortly after (plain 's' key)
      setTimeout(() => {
        service.testHandleKeydown(KeyboardEvents.plain('s'));
      }, 50);

      setTimeout(() => {
        expect(action).toHaveBeenCalled();
        done();
      }, 200);
    });

    it('should clear pending multi-step sequence on window blur', () => {
      const action = jasmine.createSpy('multiStepActionBlur');
      const shortcut = createMultiStepMockShortcut({
        id: 'multi-step-blur',
        steps: [['ctrl', 'k'], ['s']],
        action,
      });

      service.register(shortcut);

      // Start the sequence by sending the first step
      service.testHandleKeydown(KeyboardEvents.ctrlK());

  // Simulate window blur which should clear the pending sequence
  service.testHandleWindowBlur();

  // Send the second step - action should NOT be called because sequence was cleared
  service.testHandleKeydown(KeyboardEvents.plain('s'));

      expect(action).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in shortcut actions gracefully', () => {
      const errorAction = jasmine.createSpy('errorAction').and.throwError('Test error');
      const consoleErrorSpy = spyOn(console, 'error');

      const shortcut = { ...mockShortcut, action: errorAction };
      service.register(shortcut);

      // Simulate key press handling
      const testableService = service as any;
      const event = new KeyboardEvent('keydown', {
        ctrlKey: true,
        key: 's'
      });

      expect(() => testableService.testHandleKeydown(event)).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Platform Detection', () => {
    it('should detect mac platform correctly', () => {
      const testableService = service as any;

      // Mock navigator for Mac by mocking the isMacPlatform method instead
      spyOn(testableService, 'testIsMacPlatform').and.returnValue(true);

      expect(testableService.testIsMacPlatform()).toBe(true);
    });

    it('should detect non-mac platform correctly', () => {
      const testableService = service as any;

      spyOn(testableService, 'testIsMacPlatform').and.returnValue(false);

      expect(testableService.testIsMacPlatform()).toBe(false);
    });
  });

  describe('Browser Environment Handling', () => {
    it('should handle non-browser environment gracefully', () => {
      const localService = TestBed.inject(TestableKeyboardShortcuts);
      expect(() => localService).not.toThrow();
    });
  });

  describe('ReadOnly Maps', () => {
    it('should return readonly maps for shortcuts and groups', () => {
      const shortcuts = service.getShortcuts();
      const groups = service.getGroups();

      expect(shortcuts).toBeDefined();
      expect(groups).toBeDefined();

      // These should be readonly - attempting to modify should not affect the service
      expect(() => (shortcuts as any).clear).toBeDefined();
      expect(() => (groups as any).clear).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    describe('Duplicate Registration Prevention', () => {
      it('should throw error when registering shortcut with duplicate ID', () => {
        const shortcut: KeyboardShortcut = {
          id: 'test-shortcut',
          keys: ['ctrl', 's'],
          macKeys: ['meta', 's'],
          action: () => { },
          description: 'Test shortcut'
        };

        service.register(shortcut);

        expect(() => service.register(shortcut)).toThrowError(
          KeyboardShortcutsErrors.SHORTCUT_ALREADY_REGISTERED('test-shortcut')
        );
      });

      it('should throw error when registering shortcut with conflicting key combination', () => {
        service.register({ ...mockShortcut, id: 'shortcut-1' });

        const conflictingShortcut = {
          ...mockShortcut,
          id: 'shortcut-2',
          keys: ['ctrl', 's'] // Conflict
        };

        expect(() => service.register(conflictingShortcut)).toThrowError(
          KeyboardShortcutsErrors.KEY_CONFLICT('shortcut-1')
        );
      });

      it('should throw error when registering group with duplicate group ID', () => {
        const shortcuts: KeyboardShortcut[] = [{
          id: 'shortcut1',
          keys: ['f1'],
          macKeys: ['f1'],
          action: () => { },
          description: 'Test'
        }];

        service.registerGroup('test-group', shortcuts);

        expect(() => service.registerGroup('test-group', shortcuts)).toThrowError(
          KeyboardShortcutsErrors.GROUP_ALREADY_REGISTERED('test-group')
        );
      });

      it('should throw error when registering group with duplicate shortcut IDs', () => {
        const shortcut: KeyboardShortcut = {
          id: 'duplicate-shortcut',
          keys: ['f1'],
          macKeys: ['f1'],
          action: () => { },
          description: 'Test'
        };

        service.register(shortcut);

        const groupShortcuts: KeyboardShortcut[] = [{
          id: 'duplicate-shortcut',
          keys: ['f2'],
          macKeys: ['f2'],
          action: () => { },
          description: 'Duplicate'
        }];

        expect(() => service.registerGroup('new-group', groupShortcuts)).toThrowError(
          KeyboardShortcutsErrors.SHORTCUT_IDS_ALREADY_REGISTERED(['duplicate-shortcut'])
        );
      });

      it('should throw error when registering group with duplicate shortcuts within the group', () => {
        const groupShortcuts: KeyboardShortcut[] = [
          {
            id: 'same-id',
            keys: ['f1'],
            macKeys: ['f1'],
            action: () => { },
            description: 'First'
          },
          {
            id: 'same-id',
            keys: ['f2'],
            macKeys: ['f2'],
            action: () => { },
            description: 'Second'
          }
        ];

        expect(() => service.registerGroup('group-with-duplicates', groupShortcuts)).toThrowError(
          KeyboardShortcutsErrors.DUPLICATE_SHORTCUTS_IN_GROUP(['same-id'])
        );
      });

      it('should throw error when registering group with conflicting key combination', () => {
        service.register({ ...mockShortcut, id: 'existing-shortcut', keys: ['ctrl', 'p'] });

        const groupShortcuts: KeyboardShortcut[] = [{
          id: 'new-shortcut',
          keys: ['ctrl', 'p'], // Conflict
          macKeys: ['meta', 'o'],
          action: () => { },
          description: 'New'
        }];

        expect(() => service.registerGroup('conflict-group', groupShortcuts)).toThrowError(
          KeyboardShortcutsErrors.KEY_CONFLICTS_IN_GROUP(['"new-shortcut" conflicts with "existing-shortcut"'])
        );
      });
    });

    describe('Operation on Non-Existent Items', () => {
      it('should throw error when unregistering non-existent shortcut', () => {
        expect(() => service.unregister('non-existent')).toThrowError(
          KeyboardShortcutsErrors.CANNOT_UNREGISTER_SHORTCUT('non-existent')
        );
      });

      it('should throw error when unregistering non-existent group', () => {
        expect(() => service.unregisterGroup('non-existent')).toThrowError(
          KeyboardShortcutsErrors.CANNOT_UNREGISTER_GROUP('non-existent')
        );
      });

      it('should throw error when activating non-existent shortcut', () => {
        expect(() => service.activate('non-existent')).toThrowError(
          KeyboardShortcutsErrors.CANNOT_ACTIVATE_SHORTCUT('non-existent')
        );
      });

      it('should throw error when deactivating non-existent shortcut', () => {
        expect(() => service.deactivate('non-existent')).toThrowError(
          KeyboardShortcutsErrors.CANNOT_DEACTIVATE_SHORTCUT('non-existent')
        );
      });

      it('should throw error when activating non-existent group', () => {
        expect(() => service.activateGroup('non-existent')).toThrowError(
          KeyboardShortcutsErrors.CANNOT_ACTIVATE_GROUP('non-existent')
        );
      });

      it('should throw error when deactivating non-existent group', () => {
        expect(() => service.deactivateGroup('non-existent')).toThrowError(
          KeyboardShortcutsErrors.CANNOT_DEACTIVATE_GROUP('non-existent')
        );
      });
    });

    describe('Registration Check Methods', () => {
      it('should correctly check if shortcut is registered', () => {
        const shortcut: KeyboardShortcut = {
          id: 'check-shortcut',
          keys: ['f1'],
          macKeys: ['f1'],
          action: () => { },
          description: 'Test'
        };

        expect(service.isRegistered('check-shortcut')).toBe(false);

        service.register(shortcut);

        expect(service.isRegistered('check-shortcut')).toBe(true);
      });

      it('should correctly check if group is registered', () => {
        const shortcuts: KeyboardShortcut[] = [{
          id: 'group-check-shortcut',
          keys: ['f1'],
          macKeys: ['f1'],
          action: () => { },
          description: 'Test'
        }];

        expect(service.isGroupRegistered('check-group')).toBe(false);

        service.registerGroup('check-group', shortcuts);

        expect(service.isGroupRegistered('check-group')).toBe(true);
      });
    });
  });
});
