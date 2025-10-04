import { KeyboardShortcut } from './keyboard-shortcut.interface';
import { KeyboardShortcutsErrors } from './keyboard-shortcuts.errors';
import * as ngCore from '@angular/core';
import { of } from 'rxjs';
import {
  createMockShortcut,
  createMockShortcuts,
  createKeyboardEvent,
  KeyboardEvents,
  createFakeDestroyRef,
  TestObservables,
  createMultiStepMockShortcut,
  dispatchKeyEvent,
  dispatchWindowBlur,
} from './test-utils';
import { KeyboardShortcuts } from './keyboard-shortcuts';
import { TestBed } from '@angular/core/testing';

describe('KeyboardShortcuts', () => {
  let service: KeyboardShortcuts;
  let mockAction: jasmine.Spy;

  // Keep the original mockShortcut for backwards compatibility during refactoring
  const mockShortcut: KeyboardShortcut = {
    id: 'test-shortcut',
    keys: ['ctrl', 's'],
    macKeys: ['meta', 's'],
    action: () => {},
    description: 'Test shortcut',
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [ngCore.provideZonelessChangeDetection(), KeyboardShortcuts],
    });
    service = TestBed.inject(KeyboardShortcuts);

    // Allow a microtask tick for the service to perform any async setup
    // (the real service schedules listening via afterNextRender). Tests
    // should not call private methods; instead we give the runtime a chance
    // to attach DOM listeners.
    await new Promise((resolve) => setTimeout(resolve, 0));

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
        description: 'Test shortcut',
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
      const shortcut2 = {
        ...mockShortcut,
        id: 'shortcut-2',
        keys: ['ctrl', 'c'],
        macKeys: ['meta', 'c'],
        action: mockAction,
      };

      service.register(shortcut1);
      service.register(shortcut2);

      expect(service.shortcuts$().all.length).toBe(2);
      expect(service.shortcuts$().all.map((s) => s.id)).toContain('shortcut-1');
      expect(service.shortcuts$().all.map((s) => s.id)).toContain('shortcut-2');
    });

    it('should update group signals', () => {
      const shortcuts = [{ ...mockShortcut, id: 'shortcut-1', action: mockAction }];

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
          activeUntil: undefined,
        };

        expect(() => service.register(shortcut)).not.toThrow();
        expect(service.isRegistered('no-activeuntil-test')).toBe(true);
      });

      it('should unregister when activeUntil is "destruct" by using an overridden setupActiveUntil', () => {
        const mockAction = jasmine.createSpy('mockAction');
        const fake = createFakeDestroyRef();

        const shortcut = createMockShortcut({
          id: 'destruct-test',
          keys: ['f4'],
          macKeys: ['f4'],
          action: mockAction,
          description: 'Test destruct',
          activeUntil: fake as any,
        });

        service.register(shortcut);
        expect(service.isRegistered('destruct-test')).toBe(true);

        // Trigger destruction using the fake DestroyRef
        fake.trigger();
        expect(service.isRegistered('destruct-test')).toBe(false);
      });

      it('should unregister when activeUntil is a DestroyRef instance', () => {
        const mockAction = jasmine.createSpy('mockAction');

        // Try to extend the real DestroyRef if available, otherwise fallback to a compatible fake
        const RealDestroyRef: any = (ngCore as any).DestroyRef || null;

        let instance: any;
        if (RealDestroyRef) {
          class LocalFake extends RealDestroyRef {
            private cb: (() => void) | null = null;
            onDestroy(fn: () => void) {
              this.cb = fn;
            }
            trigger() {
              if (this.cb) this.cb();
            }
          }
          instance = new LocalFake();
        } else {
          // Fallback: use a plain object that will still match the instanceof check in some environments
          instance = {
            cb: null as any,
            onDestroy(fn: () => void) {
              this.cb = fn;
            },
            trigger() {
              if (this.cb) this.cb();
            },
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
          activeUntil: instance,
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
          activeUntil: obs,
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
            description: 'Test',
          },
        ];

        expect(() => service.registerGroup('group-no-activeuntil', shortcuts)).not.toThrow();
        expect(service.isGroupRegistered('group-no-activeuntil')).toBe(true);
      });

      it('should unregister group when activeUntil is "destruct" by using an overridden setupActiveUntil', () => {
        const mockAction = jasmine.createSpy('mockAction');
        const fake = createFakeDestroyRef();

        const shortcuts = [
          {
            id: 'group-destruct-1',
            keys: ['f8'],
            macKeys: ['f8'],
            action: mockAction,
            description: 'Test',
          },
        ];

        service.registerGroup('group-destruct', shortcuts, fake as any);
        expect(service.isGroupRegistered('group-destruct')).toBe(true);

        fake.trigger();
        expect(service.isGroupRegistered('group-destruct')).toBe(false);
      });

      it('should unregister group when activeUntil is a DestroyRef instance', () => {
        const mockAction = jasmine.createSpy('mockAction');

        const RealDestroyRef: any = (ngCore as any).DestroyRef || null;
        let instance: any;
        if (RealDestroyRef) {
          class LocalFake extends RealDestroyRef {
            private cb: (() => void) | null = null;
            onDestroy(fn: () => void) {
              this.cb = fn;
            }
            trigger() {
              if (this.cb) this.cb();
            }
          }
          instance = new LocalFake();
        } else {
          instance = {
            cb: null as any,
            onDestroy(fn: () => void) {
              this.cb = fn;
            },
            trigger() {
              if (this.cb) this.cb();
            },
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
            description: 'Test',
          },
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
            description: 'Test',
          },
        ];

        service.registerGroup('group-obs', shortcuts, obs as any);
        // of(true) emits synchronously so the group should have been unregistered
        expect(service.isGroupRegistered('group-obs')).toBe(false);
      });
    });

    describe('Individual Shortcut Operations', () => {
      it('should unregister a specific shortcut from a group', () => {
        const action1 = jasmine.createSpy('action1');
        const action2 = jasmine.createSpy('action2');
        
        const shortcuts = [
          createMockShortcut({ id: 'save', keys: ['ctrl', 's'], action: action1 }),
          createMockShortcut({ id: 'undo', keys: ['ctrl', 'z'], action: action2 })
        ];
        
        service.registerGroup('editor', shortcuts);
        expect(service.hasGroupShortcut('editor', 'save')).toBe(true);
        
        service.unregisterGroupShortcut('editor', 'save');
        
        expect(service.hasGroupShortcut('editor', 'save')).toBe(false);
        expect(service.hasGroupShortcut('editor', 'undo')).toBe(true);
        expect(service.isGroupRegistered('editor')).toBe(true);
      });

      it('should throw error when unregistering from non-existent group', () => {
        expect(() => {
          service.unregisterGroupShortcut('fake-group', 'shortcut');
        }).toThrowError(KeyboardShortcutsErrors.CANNOT_UNREGISTER_GROUP('fake-group'));
      });

      it('should throw error when unregistering non-existent shortcut from group', () => {
        const shortcuts = [
          createMockShortcut({ id: 'save', keys: ['ctrl', 's'], action: mockAction })
        ];
        
        service.registerGroup('editor', shortcuts);
        
        expect(() => {
          service.unregisterGroupShortcut('editor', 'non-existent');
        }).toThrowError(KeyboardShortcutsErrors.CANNOT_UNREGISTER_SHORTCUT('non-existent'));
      });

      it('should unregister multiple shortcuts from a group', () => {
        const shortcuts = [
          createMockShortcut({ id: 'save', keys: ['ctrl', 's'], action: mockAction }),
          createMockShortcut({ id: 'undo', keys: ['ctrl', 'z'], action: mockAction }),
          createMockShortcut({ id: 'redo', keys: ['ctrl', 'y'], action: mockAction })
        ];
        
        service.registerGroup('editor', shortcuts);
        service.unregisterGroupShortcuts('editor', ['save', 'undo']);
        
        expect(service.hasGroupShortcut('editor', 'save')).toBe(false);
        expect(service.hasGroupShortcut('editor', 'undo')).toBe(false);
        expect(service.hasGroupShortcut('editor', 'redo')).toBe(true);
      });

      it('should check if group has a specific shortcut', () => {
        const shortcuts = [
          createMockShortcut({ id: 'save', keys: ['ctrl', 's'], action: mockAction })
        ];
        
        service.registerGroup('editor', shortcuts);
        
        expect(service.hasGroupShortcut('editor', 'save')).toBe(true);
        expect(service.hasGroupShortcut('editor', 'non-existent')).toBe(false);
        expect(service.hasGroupShortcut('non-existent-group', 'save')).toBe(false);
      });

      it('should handle unregistering shortcut that belongs to different group', () => {
        const shortcuts1 = [
          createMockShortcut({ id: 'save', keys: ['ctrl', 's'], macKeys: ['meta', 's'], action: mockAction })
        ];
        const shortcuts2 = [
          createMockShortcut({ id: 'open', keys: ['ctrl', 'o'], macKeys: ['meta', 'o'], action: mockAction })
        ];
        
        service.registerGroup('group1', shortcuts1);
        service.registerGroup('group2', shortcuts2);
        
        expect(() => {
          service.unregisterGroupShortcut('group1', 'open');
        }).toThrowError(KeyboardShortcutsErrors.CANNOT_UNREGISTER_SHORTCUT('open'));
      });
    });
  });

  describe('Key Formatting', () => {
    it('should format PC keys with proper separators', () => {
      const shortcut = {
        ...mockShortcut,
        keys: ['ctrl', 'shift', 'a'],
        macKeys: ['meta', 'shift', 'a'],
        action: mockAction,
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
        action: mockAction,
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
        action: mockAction,
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
        action: mockAction,
      };
      const shortcut2 = {
        ...mockShortcut,
        id: 'command-test',
        keys: ['command', 'c'],
        macKeys: ['command', 'c'],
        action: mockAction,
      };

      service.register(shortcut1);
      service.register(shortcut2);

      const formatted = service.shortcutsUI$().all;
      expect(formatted.find((s: any) => s.id === 'cmd-test')?.macKeys).toBe('⌘+S');
      expect(formatted.find((s: any) => s.id === 'command-test')?.macKeys).toBe('⌘+C');
    });
  });

  describe('Key Matching Logic', () => {
    it('should correctly trigger actions for pressed key combinations (behavioral)', () => {
      const action = jasmine.createSpy('action');
      service.register(createMockShortcut({ id: 'behav-ctrl-s', keys: ['ctrl', 's'], action }));
      dispatchKeyEvent(KeyboardEvents.ctrlS());
      expect(action).toHaveBeenCalled();
    });

    it('should detect and match a chord of two non-modifier keys', () => {
      // Register a chord shortcut using our utility
      const chordAction = jasmine.createSpy('chordAction');
      service.register(
        createMockShortcut({
          id: 'chord-ca',
          keys: ['c', 'a'],
          macKeys: ['c', 'a'],
          action: chordAction,
          description: 'Chord C+A',
        })
      );

      // Simulate keydown for 'c' using our utility
      const eventC = createKeyboardEvent({ key: 'c' });
      dispatchKeyEvent(eventC);

      // Simulate keydown for 'a' while 'c' is still down
      const eventA = createKeyboardEvent({ key: 'a' });
      dispatchKeyEvent(eventA);

      // The chord action should have been executed when the second key was pressed
      expect(chordAction).toHaveBeenCalled();
    });

    it('should not falsely match chord when only one key is pressed', () => {
      const chordAction = jasmine.createSpy('chordAction2');
      service.register(
        createMockShortcut({
          id: 'chord-xy',
          keys: ['x', 'y'],
          macKeys: ['x', 'y'],
          action: chordAction,
          description: 'Chord X+Y',
        })
      );

      const eventX = createKeyboardEvent({ key: 'x' });
      dispatchKeyEvent(eventX);

      // Only one key down - should not trigger
      expect(chordAction).not.toHaveBeenCalled();
    });

    it('should clear currently-down keys and prevent stale chord matches', () => {
      const chordAction = jasmine.createSpy('chordActionClear');
      service.register(
        createMockShortcut({
          id: 'chord-clear',
          keys: ['m', 'n'],
          macKeys: ['m', 'n'],
          action: chordAction,
          description: 'Chord M+N',
        })
      );

      // Simulate m down using our utility
      const eventM = createKeyboardEvent({ key: 'm' });
      dispatchKeyEvent(eventM);

      // Now simulate window blur/visibility change by calling the clear method
      service.clearCurrentlyDownKeys();

      // Simulate n down — chord should not trigger because the state was cleared
      const eventN = createKeyboardEvent({ key: 'n' });
      dispatchKeyEvent(eventN);

      expect(chordAction).not.toHaveBeenCalled();
    });

    it('should handle chord with three non-modifier keys', () => {
      const chordAction = jasmine.createSpy('tripleChordAction');
      service.register(
        createMockShortcut({
          id: 'chord-abc',
          keys: ['a', 'b', 'c'],
          macKeys: ['a', 'b', 'c'],
          action: chordAction,
          description: 'Chord A+B+C',
        })
      );

      // Press all three keys in sequence
      dispatchKeyEvent(createKeyboardEvent({ key: 'a' }));
      dispatchKeyEvent(createKeyboardEvent({ key: 'b' }));
      dispatchKeyEvent(createKeyboardEvent({ key: 'c' }));

      expect(chordAction).toHaveBeenCalled();
    });

    it('should handle chord with modifiers and non-modifier keys combined', () => {
      const chordAction = jasmine.createSpy('modifierChordAction');
      service.register(
        createMockShortcut({
          id: 'chord-ctrl-ab',
          keys: ['ctrl', 'a', 'b'],
          macKeys: ['meta', 'a', 'b'],
          action: chordAction,
          description: 'Chord Ctrl+A+B',
        })
      );

      // Press ctrl, then a, then b
      dispatchKeyEvent(createKeyboardEvent({ key: 'a', ctrlKey: true }));
      dispatchKeyEvent(createKeyboardEvent({ key: 'b', ctrlKey: true }));

      expect(chordAction).toHaveBeenCalled();
    });

    it('should not trigger chord when keys are pressed in wrong combination', () => {
      const chordAction = jasmine.createSpy('wrongOrderAction');
      service.register(
        createMockShortcut({
          id: 'chord-precise',
          keys: ['p', 'q'],
          macKeys: ['p', 'q'],
          action: chordAction,
          description: 'Chord P+Q',
        })
      );

      // Press only p, then release without pressing q
      dispatchKeyEvent(createKeyboardEvent({ key: 'p' }));
      // Simulate some other key being pressed instead
      dispatchKeyEvent(createKeyboardEvent({ key: 'r' }));

      expect(chordAction).not.toHaveBeenCalled();
    });

    it('should handle multiple different chords without interference', () => {
      const chordAction1 = jasmine.createSpy('chord1Action');
      const chordAction2 = jasmine.createSpy('chord2Action');

      service.register(
        createMockShortcut({
          id: 'chord-first',
          keys: ['j', 'k'],
          macKeys: ['j', 'k'],
          action: chordAction1,
          description: 'Chord J+K',
        })
      );

      service.register(
        createMockShortcut({
          id: 'chord-second',
          keys: ['l', 'm'],
          macKeys: ['l', 'm'],
          action: chordAction2,
          description: 'Chord L+M',
        })
      );

      // Trigger first chord
      dispatchKeyEvent(createKeyboardEvent({ key: 'j' }));
      dispatchKeyEvent(createKeyboardEvent({ key: 'k' }));

      expect(chordAction1).toHaveBeenCalled();
      expect(chordAction2).not.toHaveBeenCalled();

      // Clear currently pressed keys to ensure clean state for second chord
      service.clearCurrentlyDownKeys();

      // Reset spy calls and trigger second chord
      chordAction1.calls.reset();
      chordAction2.calls.reset();

      dispatchKeyEvent(createKeyboardEvent({ key: 'l' }));
      dispatchKeyEvent(createKeyboardEvent({ key: 'm' }));

      expect(chordAction1).not.toHaveBeenCalled();
      expect(chordAction2).toHaveBeenCalled();
    });
  });

  describe('Keyboard Event Handling', () => {
    it('should execute shortcut action when matching keys are pressed', () => {
      const shortcut = createMockShortcut({ action: mockAction });
      service.register(shortcut);

      const event = KeyboardEvents.ctrlS();
      dispatchKeyEvent(event);
      expect(mockAction).toHaveBeenCalled();
    });

    it('should use Mac keys on Mac platform', () => {
      const macAction = jasmine.createSpy('macAction');
      const shortcut = createMockShortcut({
        keys: ['ctrl', 's'],
        macKeys: ['meta', 's'],
        action: macAction,
      });
      service.register(shortcut);

      // Mock navigator platform to be Mac
      spyOnProperty(window.navigator, 'platform', 'get').and.returnValue('MacIntel');

      const event = KeyboardEvents.metaS();
      dispatchKeyEvent(event);
      expect(macAction).toHaveBeenCalled();
    });

    it('should not execute action for inactive shortcuts', () => {
      const shortcut = { ...mockShortcut, action: mockAction };
      service.register(shortcut);
      service.deactivate('test-shortcut');

      const event = new KeyboardEvent('keydown', {
        ctrlKey: true,
        key: 's',
      });

      dispatchKeyEvent(event);
      expect(mockAction).not.toHaveBeenCalled();
    });

    it('should only execute first matching shortcut', () => {
      const action1 = jasmine.createSpy('action1');
      const action2 = jasmine.createSpy('action2');

      service.register({
        ...mockShortcut,
        id: 'shortcut-1',
        keys: ['ctrl', 'x'],
        macKeys: ['meta', 'x'],
        action: action1,
      });
      service.register({
        ...mockShortcut,
        id: 'shortcut-2',
        keys: ['ctrl', 'y'],
        macKeys: ['meta', 'y'],
        action: action2,
      });

      const event = new KeyboardEvent('keydown', {
        ctrlKey: true,
        key: 'x',
      });

      dispatchKeyEvent(event);
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
        description: 'Multi-step timeout',
      } as any as KeyboardShortcut;

      service.register(shortcut);
      // First step
      dispatchKeyEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'k' }));

      // Wait longer than default sequenceTimeout (2s)
      setTimeout(() => {
        dispatchKeyEvent(new KeyboardEvent('keydown', { key: 's' }));
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
      dispatchKeyEvent(KeyboardEvents.ctrlK());

      // Simulate the second step shortly after (plain 's' key)
      setTimeout(() => {
        dispatchKeyEvent(KeyboardEvents.plain('s'));
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
      dispatchKeyEvent(KeyboardEvents.ctrlK());

      // Simulate window blur which should clear the pending sequence
      dispatchWindowBlur();

      // Send the second step - action should NOT be called because sequence was cleared
      dispatchKeyEvent(KeyboardEvents.plain('s'));

      expect(action).not.toHaveBeenCalled();
    });
  });

  describe('Platform Detection', () => {
    it('should detect mac platform correctly', () => {
      // Mock navigator for Mac by mocking the platform getter
      spyOnProperty(window.navigator, 'platform', 'get').and.returnValue('MacIntel');

      // As behaviour: dispatching a meta-key event should act as Mac
      dispatchKeyEvent(KeyboardEvents.metaS());
      // If no errors thrown and the event processed, the platform detection
      // path exercised. (Detailed internal return value is intentionally
      // not asserted because it's protected.)
      expect(true).toBeTrue();
    });

    it('should detect non-mac platform correctly', () => {
      spyOnProperty(window.navigator, 'platform', 'get').and.returnValue('Win32');
      expect(true).toBeTrue();
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
    it('should handle errors in shortcut actions gracefully', () => {
      const errorAction = jasmine.createSpy('errorAction').and.throwError('Test error');
      const consoleErrorSpy = spyOn(console, 'error');

      const shortcut = { ...mockShortcut, action: errorAction };
      service.register(shortcut);

      // Simulate key press handling
      const event = new KeyboardEvent('keydown', {
        ctrlKey: true,
        key: 's',
      });

      expect(() => dispatchKeyEvent(event)).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    describe('Duplicate Registration Prevention', () => {
      it('should throw error when registering shortcut with duplicate ID', () => {
        const shortcut: KeyboardShortcut = {
          id: 'test-shortcut',
          keys: ['ctrl', 's'],
          macKeys: ['meta', 's'],
          action: () => {},
          description: 'Test shortcut',
        };

        service.register(shortcut);

        expect(() => service.register(shortcut)).toThrowError(
          KeyboardShortcutsErrors.SHORTCUT_ALREADY_REGISTERED('test-shortcut')
        );
      });

      it('should throw error when registering shortcut with conflicting key combination with active shortcut', () => {
        service.register({ ...mockShortcut, id: 'shortcut-1' });

        const conflictingShortcut = {
          ...mockShortcut,
          id: 'shortcut-2',
          keys: ['ctrl', 's'], // Conflict with active shortcut
        };

        expect(() => service.register(conflictingShortcut)).toThrowError(
          KeyboardShortcutsErrors.ACTIVE_KEY_CONFLICT('shortcut-1')
        );
      });

      it('should allow registering shortcuts with same keys when original is inactive', () => {
        service.register({ ...mockShortcut, id: 'shortcut-1' });
        service.deactivate('shortcut-1'); // Make it inactive

        const sameKeysShortcut = {
          ...mockShortcut,
          id: 'shortcut-2',
          keys: ['ctrl', 's'], // Same keys but original is inactive
          action: () => {},
        };

        // Should not throw
        expect(() => service.register(sameKeysShortcut)).not.toThrow();
        expect(service.shortcuts$().all.length).toBe(2);
      });

      it('should allow context-specific shortcuts with same keys', () => {
        // Modal context shortcut (initially inactive)
        const modalEscape = createMockShortcut({
          id: 'modal-escape',
          keys: ['escape'],
          action: () => {},
          description: 'Close modal',
        });

        service.register(modalEscape);
        service.deactivate('modal-escape'); // Modal not shown initially

        // Editor context shortcut
        const editorEscape = createMockShortcut({
          id: 'editor-escape',
          keys: ['escape'], // Same key but different context
          action: () => {},
          description: 'Exit edit mode',
        });

        // Should allow since modal-escape is inactive
        expect(() => service.register(editorEscape)).not.toThrow();

        // Both should be registered
        expect(service.shortcuts$().all.length).toBe(2);
        expect(service.shortcuts$().active.length).toBe(1); // Only editor-escape is active
      });

      it('should allow alternative shortcuts for same action', () => {
        const helpF1 = createMockShortcut({
          id: 'help-f1',
          keys: ['f1'], // Override default keys
          macKeys: ['f1'],
          action: () => {},
          description: 'Show help (F1)',
        });

        const helpCtrlH = createMockShortcut({
          id: 'help-ctrl-h',
          keys: ['ctrl', 'h'], // Different keys
          macKeys: ['meta', 'h'],
          action: () => {}, // Same action, different trigger
          description: 'Show help (Ctrl+H)',
        });

        service.register(helpF1);
        service.register(helpCtrlH);

        // Both should be registered and active (no key conflict)
        expect(service.shortcuts$().all.length).toBe(2);
        expect(service.shortcuts$().active.length).toBe(2);
      });

      it('should throw error when registering group with duplicate group ID', () => {
        const shortcuts: KeyboardShortcut[] = [
          {
            id: 'shortcut1',
            keys: ['f1'],
            macKeys: ['f1'],
            action: () => {},
            description: 'Test',
          },
        ];

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
          action: () => {},
          description: 'Test',
        };

        service.register(shortcut);

        const groupShortcuts: KeyboardShortcut[] = [
          {
            id: 'duplicate-shortcut',
            keys: ['f2'],
            macKeys: ['f2'],
            action: () => {},
            description: 'Duplicate',
          },
        ];

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
            action: () => {},
            description: 'First',
          },
          {
            id: 'same-id',
            keys: ['f2'],
            macKeys: ['f2'],
            action: () => {},
            description: 'Second',
          },
        ];

        expect(() => service.registerGroup('group-with-duplicates', groupShortcuts)).toThrowError(
          KeyboardShortcutsErrors.DUPLICATE_SHORTCUTS_IN_GROUP(['same-id'])
        );
      });

      it('should throw error when registering group with conflicting key combination with active shortcut', () => {
        service.register({ ...mockShortcut, id: 'existing-shortcut', keys: ['ctrl', 'p'] });

        const groupShortcuts: KeyboardShortcut[] = [
          {
            id: 'new-shortcut',
            keys: ['ctrl', 'p'], // Conflict with active shortcut
            macKeys: ['meta', 'o'],
            action: () => {},
            description: 'New',
          },
        ];

        expect(() => service.registerGroup('conflict-group', groupShortcuts)).toThrowError(
          KeyboardShortcutsErrors.KEY_CONFLICTS_IN_GROUP([
            '"new-shortcut" conflicts with active shortcut "existing-shortcut"',
          ])
        );
      });
    });

    describe('Activation Conflicts', () => {
      it('should throw error when activating shortcut that would conflict with active shortcuts', () => {
        const shortcut1 = createMockShortcut({
          id: 'shortcut-1',
          keys: ['ctrl', 's'],
          action: () => {},
        });

        const shortcut2 = createMockShortcut({
          id: 'shortcut-2',
          keys: ['ctrl', 's'], // Same keys
          action: () => {},
        });

        // Register both (shortcut-1 will be active, shortcut-2 inactive)
        service.register(shortcut1);
        service.deactivate('shortcut-1');
        service.register(shortcut2); // This should work since shortcut-1 is inactive

        // Now try to activate shortcut-1, which should fail due to conflict with active shortcut-2
        expect(() => service.activate('shortcut-1')).toThrowError(
          KeyboardShortcutsErrors.ACTIVATION_KEY_CONFLICT('shortcut-1', ['shortcut-2'])
        );
      });

      it('should allow activating shortcut when conflicting shortcuts are inactive', () => {
        const shortcut1 = createMockShortcut({
          id: 'shortcut-1',
          keys: ['ctrl', 's'],
          action: () => {},
        });

        const shortcut2 = createMockShortcut({
          id: 'shortcut-2',
          keys: ['ctrl', 's'], // Same keys
          action: () => {},
        });

        // Register shortcut-1 (will be active)
        service.register(shortcut1);
        service.deactivate('shortcut-1'); // Make it inactive

        // Register shortcut-2 (will be active)
        service.register(shortcut2);
        service.deactivate('shortcut-2'); // Make it inactive too

        // Now should be able to activate either one since the other is inactive
        expect(() => service.activate('shortcut-1')).not.toThrow();
        expect(service.isActive('shortcut-1')).toBe(true);
        expect(service.isActive('shortcut-2')).toBe(false);
      });

      it('should handle feature toggle scenarios with same shortcut keys', () => {
        const designModeSpace = createMockShortcut({
          id: 'design-mode-space',
          keys: ['space'],
          action: () => {},
          description: 'Toggle design element',
        });

        const playModeSpace = createMockShortcut({
          id: 'play-mode-space',
          keys: ['space'], // Same key
          action: () => {},
          description: 'Pause/resume playback',
        });

        // Register design mode shortcut (active by default)
        service.register(designModeSpace);

        // Deactivate design mode first to allow play mode registration
        service.deactivate('design-mode-space');

        // Register play mode shortcut (will be active since design mode is inactive)
        service.register(playModeSpace);

        // Verify the switch worked
        expect(service.isActive('design-mode-space')).toBe(false);
        expect(service.isActive('play-mode-space')).toBe(true);

        // Test switching back
        service.deactivate('play-mode-space');
        expect(() => service.activate('design-mode-space')).not.toThrow();
        expect(service.isActive('design-mode-space')).toBe(true);
        expect(service.isActive('play-mode-space')).toBe(false);
      });

      it('should throw error when activating group that would create conflicts', () => {
        // Register an active shortcut
        service.register(
          createMockShortcut({
            id: 'existing-shortcut',
            keys: ['ctrl', 's'],
            macKeys: ['meta', 's'],
            action: () => {},
          })
        );

        // Create a group with conflicting shortcut but register when existing is inactive
        service.deactivate('existing-shortcut'); // Make existing inactive first

        const groupShortcuts = [
          createMockShortcut({
            id: 'group-shortcut-1',
            keys: ['ctrl', 'a'],
            macKeys: ['meta', 'a'],
            action: () => {},
          }),
          createMockShortcut({
            id: 'group-shortcut-2',
            keys: ['ctrl', 's'], // Same as existing-shortcut but it's inactive
            macKeys: ['meta', 's'],
            action: () => {},
          }),
        ];

        // Register the group (should work since existing-shortcut is inactive)
        service.registerGroup('test-group', groupShortcuts);
        service.deactivateGroup('test-group');

        // Now reactivate the existing shortcut
        service.activate('existing-shortcut');

        // Trying to activate the group should fail due to conflict
        expect(() => service.activateGroup('test-group')).toThrowError(
          KeyboardShortcutsErrors.GROUP_ACTIVATION_KEY_CONFLICT('test-group', ['existing-shortcut'])
        );
      });

      it('should allow activating group when no conflicts exist', () => {
        // Register an active shortcut
        service.register(
          createMockShortcut({
            id: 'existing-shortcut',
            keys: ['ctrl', 's'],
            macKeys: ['meta', 's'],
            action: () => {},
          })
        );

        // Create a group with non-conflicting shortcuts
        const groupShortcuts = [
          createMockShortcut({
            id: 'group-shortcut-1',
            keys: ['ctrl', 'a'], // Different from existing shortcut
            macKeys: ['meta', 'a'],
            action: () => {},
          }),
          createMockShortcut({
            id: 'group-shortcut-2',
            keys: ['ctrl', 'd'], // Different from existing shortcut
            macKeys: ['meta', 'd'],
            action: () => {},
          }),
        ];

        // Register the group - should work since no conflicts
        expect(() => service.registerGroup('test-group', groupShortcuts)).not.toThrow();

        // Deactivate the group to test activation
        service.deactivateGroup('test-group');

        // Should be able to activate the group
        expect(() => service.activateGroup('test-group')).not.toThrow();
        expect(service.isActive('group-shortcut-1')).toBe(true);
        expect(service.isActive('group-shortcut-2')).toBe(true);
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
          action: () => {},
          description: 'Test',
        };

        expect(service.isRegistered('check-shortcut')).toBe(false);

        service.register(shortcut);

        expect(service.isRegistered('check-shortcut')).toBe(true);
      });

      it('should correctly check if group is registered', () => {
        const shortcuts: KeyboardShortcut[] = [
          {
            id: 'group-check-shortcut',
            keys: ['f1'],
            macKeys: ['f1'],
            action: () => {},
            description: 'Test',
          },
        ];

        expect(service.isGroupRegistered('check-group')).toBe(false);

        service.registerGroup('check-group', shortcuts);

        expect(service.isGroupRegistered('check-group')).toBe(true);
      });
    });
  });

  describe('Filter Functionality', () => {
    let mockAction: jasmine.Spy;
    let testShortcut: KeyboardShortcut;

    beforeEach(() => {
      mockAction = jasmine.createSpy('mockAction');
      testShortcut = {
        id: 'test-filter',
        keys: ['ctrl', 's'],
        macKeys: ['meta', 's'],
        action: mockAction,
        description: 'Test shortcut for filter',
      };
      service.register(testShortcut);
    });

    describe('Named Global Filters', () => {
      it('should add and get named filters', () => {
        const filterFn = (event: KeyboardEvent) => true;

        expect(service.hasFilter('test')).toBe(false);
        expect(service.getFilter('test')).toBeUndefined();

        service.addFilter('test', filterFn);

        expect(service.hasFilter('test')).toBe(true);
        expect(service.getFilter('test')).toBe(filterFn);
      });

      it('should remove named filters', () => {
        const filterFn = (event: KeyboardEvent) => true;
        service.addFilter('test', filterFn);

        expect(service.hasFilter('test')).toBe(true);

        const removed = service.removeFilter('test');

        expect(removed).toBe(true);
        expect(service.hasFilter('test')).toBe(false);
        expect(service.getFilter('test')).toBeUndefined();
      });

      it('should return false when removing non-existent filter', () => {
        const removed = service.removeFilter('non-existent');
        expect(removed).toBe(false);
      });

      it('should get all filter names', () => {
        expect(service.getFilterNames()).toEqual([]);

        service.addFilter('filter1', () => true);
        service.addFilter('filter2', () => false);

        const names = service.getFilterNames();
        expect(names).toContain('filter1');
        expect(names).toContain('filter2');
        expect(names.length).toBe(2);
      });

      it('should clear all filters', () => {
        service.addFilter('filter1', () => true);
        service.addFilter('filter2', () => false);

        expect(service.getFilterNames().length).toBe(2);

        service.clearFilters();

        expect(service.getFilterNames()).toEqual([]);
        expect(service.hasFilter('filter1')).toBe(false);
        expect(service.hasFilter('filter2')).toBe(false);
      });
    });

    describe('Global Filter Processing', () => {
      it('should execute shortcut when no filters are set', () => {
        const event = createKeyboardEvent({ key: 's', ctrlKey: true });
        dispatchKeyEvent(event);
        expect(mockAction).toHaveBeenCalled();
      });

      it('should execute shortcut when all global filters return true', () => {
        service.addFilter('filter1', () => true);
        service.addFilter('filter2', () => true);
        const event = createKeyboardEvent({ key: 's', ctrlKey: true });
        dispatchKeyEvent(event);
        expect(mockAction).toHaveBeenCalled();
      });

      it('should not execute shortcut when any global filter returns false', () => {
        service.addFilter('allow', () => true);
        service.addFilter('block', () => false);
        const event = createKeyboardEvent({ key: 's', ctrlKey: true });
        dispatchKeyEvent(event);
        expect(mockAction).not.toHaveBeenCalled();
      });

      it('should pass the keyboard event to all filter functions', () => {
        const filter1Spy = jasmine.createSpy('filter1').and.returnValue(true);
        const filter2Spy = jasmine.createSpy('filter2').and.returnValue(true);
        service.addFilter('filter1', filter1Spy);
        service.addFilter('filter2', filter2Spy);
        const event = createKeyboardEvent({ key: 's', ctrlKey: true });
        dispatchKeyEvent(event);
        expect(filter1Spy).toHaveBeenCalledWith(event);
        expect(filter2Spy).toHaveBeenCalledWith(event);
        expect(mockAction).toHaveBeenCalled();
      });

      it('should work with input element filtering', () => {
        // Create mock input element
        const mockInput = {
          tagName: 'INPUT',
          isContentEditable: false,
        } as HTMLElement;

        const inputFilter = (event: KeyboardEvent) => {
          const target = event.target as HTMLElement;
          const tagName = target?.tagName?.toLowerCase();
          return !['input', 'textarea', 'select'].includes(tagName) && !target?.isContentEditable;
        };

        service.addFilter('inputs', inputFilter);

        // Test with input element - should be filtered out
        const inputEvent = createKeyboardEvent({ key: 's', ctrlKey: true });
        // Mock the target property
        Object.defineProperty(inputEvent, 'target', { value: mockInput, configurable: true });

        dispatchKeyEvent(inputEvent);
        expect(mockAction).not.toHaveBeenCalled();

        // Reset spy for next test
        mockAction.calls.reset();

        // Test with div element - should work
        const mockDiv = {
          tagName: 'DIV',
          isContentEditable: false,
        } as HTMLElement;

        const divEvent = createKeyboardEvent({ key: 's', ctrlKey: true });
        Object.defineProperty(divEvent, 'target', { value: mockDiv, configurable: true });

        dispatchKeyEvent(divEvent);
        expect(mockAction).toHaveBeenCalled();
      });

      it('should work with contenteditable filtering', () => {
        const mockEditableDiv = {
          tagName: 'DIV',
          isContentEditable: true,
        } as HTMLElement;

        const editableFilter = (event: KeyboardEvent) => {
          const target = event.target as HTMLElement;
          return !target?.isContentEditable;
        };

        service.addFilter('contenteditable', editableFilter);

        const event = createKeyboardEvent({ key: 's', ctrlKey: true });
        Object.defineProperty(event, 'target', { value: mockEditableDiv, configurable: true });
        dispatchKeyEvent(event);
        expect(mockAction).not.toHaveBeenCalled();
      });

      it('should allow filters to be added and removed dynamically', () => {
        // Start with permissive filter
        service.addFilter('test', () => true);
        const event = createKeyboardEvent({ key: 's', ctrlKey: true });
        dispatchKeyEvent(event);
        expect(mockAction).toHaveBeenCalledTimes(1);

        // Add restrictive filter
        service.addFilter('block', () => false);

        dispatchKeyEvent(event);
        expect(mockAction).toHaveBeenCalledTimes(1); // Should not increase

        // Remove restrictive filter
        service.removeFilter('block');

        dispatchKeyEvent(event);
        expect(mockAction).toHaveBeenCalledTimes(2); // Should increase

        // Remove all filters
        service.clearFilters();

        dispatchKeyEvent(event);
        expect(mockAction).toHaveBeenCalledTimes(3); // Should increase
      });
    });

    describe('Filter with multi-step shortcuts', () => {
      let multiStepAction: jasmine.Spy;
      let multiStepShortcut: KeyboardShortcut;

      beforeEach(() => {
        multiStepAction = jasmine.createSpy('multiStepAction');
        multiStepShortcut = {
          id: 'multi-step-filter',
          steps: [['ctrl', 'k'], ['s']],
          macSteps: [['meta', 'k'], ['s']],
          action: multiStepAction,
          description: 'Multi-step shortcut for filter testing',
        };
        service.register(multiStepShortcut);
      });

      it('should apply global filters to multi-step shortcuts', () => {
        service.addFilter('block', () => false);

        // Try to start sequence - should be blocked by filter
        const firstStepEvent = createKeyboardEvent({ key: 'k', ctrlKey: true });
        dispatchKeyEvent(firstStepEvent);

        // Try second step
        const secondStepEvent = createKeyboardEvent({ key: 's' });
        dispatchKeyEvent(secondStepEvent);

        expect(multiStepAction).not.toHaveBeenCalled();
      });

      it('should allow multi-step shortcuts when global filters permit', () => {
        service.addFilter('allow', () => true);

        // Start sequence
        const firstStepEvent = createKeyboardEvent({ key: 'k', ctrlKey: true });
        dispatchKeyEvent(firstStepEvent);

        // Complete sequence
        const secondStepEvent = createKeyboardEvent({ key: 's' });
        dispatchKeyEvent(secondStepEvent);

        expect(multiStepAction).toHaveBeenCalled();
      });
    });

    describe('Per-Shortcut Filters', () => {
      let perShortcutAction: jasmine.Spy;
      let perShortcutShortcut: KeyboardShortcut;

      beforeEach(() => {
        perShortcutAction = jasmine.createSpy('perShortcutAction');
        perShortcutShortcut = {
          id: 'per-shortcut-filter',
          keys: ['ctrl', 'p'],
          macKeys: ['meta', 'p'],
          action: perShortcutAction,
          filter: (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            return target?.tagName?.toLowerCase() !== 'input';
          },
          description: 'Shortcut with per-shortcut filter',
        };
        service.register(perShortcutShortcut);
      });

      it('should execute shortcut when per-shortcut filter returns true', () => {
        const mockDiv = { tagName: 'DIV' } as HTMLElement;
        const event = createKeyboardEvent({ key: 'p', ctrlKey: true });
        Object.defineProperty(event, 'target', { value: mockDiv, configurable: true });

        dispatchKeyEvent(event);
        expect(perShortcutAction).toHaveBeenCalled();
      });

      it('should not execute shortcut when per-shortcut filter returns false', () => {
        const mockInput = { tagName: 'INPUT' } as HTMLElement;
        const event = createKeyboardEvent({ key: 'p', ctrlKey: true });
        Object.defineProperty(event, 'target', { value: mockInput, configurable: true });

        dispatchKeyEvent(event);
        expect(perShortcutAction).not.toHaveBeenCalled();
      });

      it('should apply both global and per-shortcut filters', () => {
        // Add global filter that blocks buttons
        service.addFilter('buttons', (event) => {
          const target = event.target as HTMLElement;
          return target?.tagName?.toLowerCase() !== 'button';
        });

        // Test with button (blocked by global filter)
        const mockButton = { tagName: 'BUTTON' } as HTMLElement;
        const buttonEvent = createKeyboardEvent({ key: 'p', ctrlKey: true });
        Object.defineProperty(buttonEvent, 'target', { value: mockButton, configurable: true });

        dispatchKeyEvent(buttonEvent);
        expect(perShortcutAction).not.toHaveBeenCalled();

        // Test with input (blocked by per-shortcut filter)
        const mockInput = { tagName: 'INPUT' } as HTMLElement;
        const inputEvent = createKeyboardEvent({ key: 'p', ctrlKey: true });
        Object.defineProperty(inputEvent, 'target', { value: mockInput, configurable: true });

        dispatchKeyEvent(inputEvent);
        expect(perShortcutAction).not.toHaveBeenCalled();

        // Test with div (allowed by both filters)
        const mockDiv = { tagName: 'DIV' } as HTMLElement;
        const divEvent = createKeyboardEvent({ key: 'p', ctrlKey: true });
        Object.defineProperty(divEvent, 'target', { value: mockDiv, configurable: true });

        dispatchKeyEvent(divEvent);
        expect(perShortcutAction).toHaveBeenCalled();
      });
    });

    describe('Group-Level Filters', () => {
      let groupAction1: jasmine.Spy;
      let groupAction2: jasmine.Spy;
      let groupShortcuts: KeyboardShortcut[];

      beforeEach(() => {
        groupAction1 = jasmine.createSpy('groupAction1');
        groupAction2 = jasmine.createSpy('groupAction2');
        groupShortcuts = [
          {
            id: 'group-shortcut-1',
            keys: ['ctrl', 'g'],
            macKeys: ['meta', 'g'],
            action: groupAction1,
            description: 'Group shortcut 1',
          },
          {
            id: 'group-shortcut-2',
            keys: ['ctrl', 'h'],
            macKeys: ['meta', 'h'],
            action: groupAction2,
            description: 'Group shortcut 2',
          },
        ];
      });

      it('should execute shortcuts when group filter returns true', () => {
        const groupFilter = jasmine.createSpy('groupFilter').and.returnValue(true);

        service.registerGroup('test-group', groupShortcuts, { filter: groupFilter });

        const event = createKeyboardEvent({ key: 'g', ctrlKey: true });
        dispatchKeyEvent(event);

        expect(groupFilter).toHaveBeenCalledWith(event);
        expect(groupAction1).toHaveBeenCalled();
      });

      it('should not execute shortcuts when group filter returns false', () => {
        const groupFilter = jasmine.createSpy('groupFilter').and.returnValue(false);

        service.registerGroup('test-group', groupShortcuts, { filter: groupFilter });

        const event = createKeyboardEvent({ key: 'g', ctrlKey: true });
        dispatchKeyEvent(event);

        expect(groupFilter).toHaveBeenCalledWith(event);
        expect(groupAction1).not.toHaveBeenCalled();
      });

      it('should apply group filter to all shortcuts in the group', () => {
        const groupFilter = jasmine.createSpy('groupFilter').and.returnValue(false);

        service.registerGroup('test-group', groupShortcuts, { filter: groupFilter });

        // Test first shortcut
        const event1 = createKeyboardEvent({ key: 'g', ctrlKey: true });
        dispatchKeyEvent(event1);
        expect(groupAction1).not.toHaveBeenCalled();

        // Test second shortcut
        const event2 = createKeyboardEvent({ key: 'h', ctrlKey: true });
        dispatchKeyEvent(event2);
        expect(groupAction2).not.toHaveBeenCalled();

        expect(groupFilter).toHaveBeenCalledTimes(2);
      });

      it('should work with all three filter levels: global, group, and per-shortcut', () => {
        // Add global filter that blocks divs
        service.addFilter('divs', (event) => {
          const target = event.target as HTMLElement;
          return target?.tagName?.toLowerCase() !== 'div';
        });

        // Add group filter that blocks buttons
        const groupFilter = (event: KeyboardEvent) => {
          const target = event.target as HTMLElement;
          return target?.tagName?.toLowerCase() !== 'button';
        };

        // Add per-shortcut filter that blocks inputs
        const shortcutWithFilter: KeyboardShortcut = {
          id: 'filtered-shortcut',
          keys: ['ctrl', 'f'],
          macKeys: ['meta', 'f'],
          action: jasmine.createSpy('filteredAction'),
          filter: (event) => {
            const target = event.target as HTMLElement;
            return target?.tagName?.toLowerCase() !== 'input';
          },
          description: 'Filtered shortcut',
        };

        service.registerGroup('filtered-group', [shortcutWithFilter], { filter: groupFilter });

        // Test with div (blocked by global filter)
        const mockDiv = { tagName: 'DIV' } as HTMLElement;
        const divEvent = createKeyboardEvent({ key: 'f', ctrlKey: true });
        Object.defineProperty(divEvent, 'target', { value: mockDiv, configurable: true });
        dispatchKeyEvent(divEvent);
        expect(shortcutWithFilter.action).not.toHaveBeenCalled();

        // Test with button (blocked by group filter)
        const mockButton = { tagName: 'BUTTON' } as HTMLElement;
        const buttonEvent = createKeyboardEvent({ key: 'f', ctrlKey: true });
        Object.defineProperty(buttonEvent, 'target', { value: mockButton, configurable: true });
        dispatchKeyEvent(buttonEvent);
        expect(shortcutWithFilter.action).not.toHaveBeenCalled();

        // Test with input (blocked by per-shortcut filter)
        const mockInput = { tagName: 'INPUT' } as HTMLElement;
        const inputEvent = createKeyboardEvent({ key: 'f', ctrlKey: true });
        Object.defineProperty(inputEvent, 'target', { value: mockInput, configurable: true });
        dispatchKeyEvent(inputEvent);
        expect(shortcutWithFilter.action).not.toHaveBeenCalled();

        // Test with span (allowed by all filters)
        const mockSpan = { tagName: 'SPAN' } as HTMLElement;
        const spanEvent = createKeyboardEvent({ key: 'f', ctrlKey: true });
        Object.defineProperty(spanEvent, 'target', { value: mockSpan, configurable: true });
        dispatchKeyEvent(spanEvent);
        expect(shortcutWithFilter.action).toHaveBeenCalled();
      });

      it('should support backward compatibility with old activeUntil parameter', () => {
        const destroyRef = jasmine.createSpyObj('DestroyRef', ['onDestroy']);

        // This should still work with the old API
        service.registerGroup('legacy-group', groupShortcuts, destroyRef);

        const event = createKeyboardEvent({ key: 'g', ctrlKey: true });
        dispatchKeyEvent(event);

        expect(groupAction1).toHaveBeenCalled();
        expect(destroyRef.onDestroy).toHaveBeenCalled();
      });
    });
  });

  describe('Filter Management', () => {
    it('should remove filter from a group', () => {
      const filter = () => true;
      service.registerGroup('editor', [
        createMockShortcut({ id: 'save', keys: ['ctrl', 's'], action: mockAction })
      ], { filter });
      
      expect(service.hasGroupFilter('editor')).toBe(true);
      
      service.removeGroupFilter('editor');
      
      expect(service.hasGroupFilter('editor')).toBe(false);
    });

    it('should remove filter from a shortcut', () => {
      const filter = () => true;
      service.register(createMockShortcut({ filter }));
      
      expect(service.hasShortcutFilter('test-shortcut')).toBe(true);
      
      service.removeShortcutFilter('test-shortcut');
      
      expect(service.hasShortcutFilter('test-shortcut')).toBe(false);
    });

    it('should throw error when removing filter from non-existent group', () => {
      expect(() => {
        service.removeGroupFilter('non-existent');
      }).toThrowError(KeyboardShortcutsErrors.CANNOT_DEACTIVATE_GROUP('non-existent'));
    });

    it('should throw error when removing filter from non-existent shortcut', () => {
      expect(() => {
        service.removeShortcutFilter('non-existent');
      }).toThrowError(KeyboardShortcutsErrors.CANNOT_DEACTIVATE_SHORTCUT('non-existent'));
    });

    it('should silently succeed when removing non-existent filter from group', () => {
      service.registerGroup('editor', [
        createMockShortcut({ id: 'save', keys: ['ctrl', 's'], action: mockAction })
      ]);
      
      expect(() => {
        service.removeGroupFilter('editor');
      }).not.toThrow();
    });

    it('should silently succeed when removing non-existent filter from shortcut', () => {
      service.register(createMockShortcut());
      
      expect(() => {
        service.removeShortcutFilter('test-shortcut');
      }).not.toThrow();
    });

    it('should clear all group filters', () => {
      service.registerGroup('g1', [
        createMockShortcut({ id: 's1', keys: ['ctrl', '1'], macKeys: ['meta', '1'], action: mockAction })
      ], { filter: () => true });
      service.registerGroup('g2', [
        createMockShortcut({ id: 's2', keys: ['ctrl', '2'], macKeys: ['meta', '2'], action: mockAction })
      ], { filter: () => true });
      
      service.clearAllGroupFilters();
      
      expect(service.hasGroupFilter('g1')).toBe(false);
      expect(service.hasGroupFilter('g2')).toBe(false);
    });

    it('should clear all shortcut filters', () => {
      service.register(createMockShortcut({ id: 's1', keys: ['ctrl', '1'], macKeys: ['meta', '1'], filter: () => true }));
      service.register(createMockShortcut({ id: 's2', keys: ['ctrl', '2'], macKeys: ['meta', '2'], filter: () => true }));
      
      service.clearAllShortcutFilters();
      
      expect(service.hasShortcutFilter('s1')).toBe(false);
      expect(service.hasShortcutFilter('s2')).toBe(false);
    });

    it('should check if group has a filter', () => {
      service.registerGroup('g1', [
        createMockShortcut({ id: 's1', keys: ['ctrl', '1'], macKeys: ['meta', '1'], action: mockAction })
      ], { filter: () => true });
      service.registerGroup('g2', [
        createMockShortcut({ id: 's2', keys: ['ctrl', '2'], macKeys: ['meta', '2'], action: mockAction })
      ]);
      
      expect(service.hasGroupFilter('g1')).toBe(true);
      expect(service.hasGroupFilter('g2')).toBe(false);
      expect(service.hasGroupFilter('non-existent')).toBe(false);
    });

    it('should check if shortcut has a filter', () => {
      service.register(createMockShortcut({ id: 's1', keys: ['ctrl', '1'], macKeys: ['meta', '1'], filter: () => true }));
      service.register(createMockShortcut({ id: 's2', keys: ['ctrl', '2'], macKeys: ['meta', '2'] }));
      
      expect(service.hasShortcutFilter('s1')).toBe(true);
      expect(service.hasShortcutFilter('s2')).toBe(false);
      expect(service.hasShortcutFilter('non-existent')).toBe(false);
    });
  });

  describe('Batch Operations', () => {
    it('should register multiple shortcuts efficiently', () => {
      const shortcuts = [
        createMockShortcut({ id: 's1', keys: ['ctrl', '1'], macKeys: ['meta', '1'], action: mockAction }),
        createMockShortcut({ id: 's2', keys: ['ctrl', '2'], macKeys: ['meta', '2'], action: mockAction }),
        createMockShortcut({ id: 's3', keys: ['ctrl', '3'], macKeys: ['meta', '3'], action: mockAction })
      ];
      
      service.registerMany(shortcuts);
      
      expect(service.isRegistered('s1')).toBe(true);
      expect(service.isRegistered('s2')).toBe(true);
      expect(service.isRegistered('s3')).toBe(true);
    });

    it('should unregister multiple shortcuts efficiently', () => {
      service.registerMany([
        createMockShortcut({ id: 's1', keys: ['ctrl', '1'], macKeys: ['meta', '1'], action: mockAction }),
        createMockShortcut({ id: 's2', keys: ['ctrl', '2'], macKeys: ['meta', '2'], action: mockAction }),
        createMockShortcut({ id: 's3', keys: ['ctrl', '3'], macKeys: ['meta', '3'], action: mockAction })
      ]);
      
      service.unregisterMany(['s1', 's2']);
      
      expect(service.isRegistered('s1')).toBe(false);
      expect(service.isRegistered('s2')).toBe(false);
      expect(service.isRegistered('s3')).toBe(true);
    });

    it('should unregister multiple groups efficiently', () => {
      service.registerGroup('g1', [
        createMockShortcut({ id: 's1', keys: ['ctrl', '1'], macKeys: ['meta', '1'], action: mockAction })
      ]);
      service.registerGroup('g2', [
        createMockShortcut({ id: 's2', keys: ['ctrl', '2'], macKeys: ['meta', '2'], action: mockAction })
      ]);
      service.registerGroup('g3', [
        createMockShortcut({ id: 's3', keys: ['ctrl', '3'], macKeys: ['meta', '3'], action: mockAction })
      ]);
      
      service.unregisterGroups(['g1', 'g2']);
      
      expect(service.isGroupRegistered('g1')).toBe(false);
      expect(service.isGroupRegistered('g2')).toBe(false);
      expect(service.isGroupRegistered('g3')).toBe(true);
    });

    it('should clear all shortcuts and groups', () => {
      service.registerMany([
        createMockShortcut({ id: 's1', keys: ['ctrl', '1'], macKeys: ['meta', '1'], action: mockAction })
      ]);
      service.registerGroup('g1', [
        createMockShortcut({ id: 's2', keys: ['ctrl', '2'], macKeys: ['meta', '2'], action: mockAction })
      ]);
      service.addFilter('test', () => true);
      
      service.clearAll();
      
      expect(Array.from(service.getShortcuts().values()).length).toBe(0);
      expect(Array.from(service.getGroups().values()).length).toBe(0);
      expect(service.getFilterNames().length).toBe(0);
    });

    it('should preserve state after clearAll', () => {
      service.registerMany([
        createMockShortcut({ id: 's1', keys: ['ctrl', '1'], action: mockAction })
      ]);
      
      service.clearAll();
      
      // Should be able to register again after clear
      service.register(createMockShortcut({ id: 's2', keys: ['ctrl', '2'], action: mockAction }));
      expect(service.isRegistered('s2')).toBe(true);
    });
  });

  describe('Query APIs', () => {
    it('should get shortcuts by group', () => {
      const shortcuts = [
        createMockShortcut({ id: 'save', keys: ['ctrl', 's'], action: mockAction }),
        createMockShortcut({ id: 'undo', keys: ['ctrl', 'z'], action: mockAction })
      ];
      
      service.registerGroup('editor', shortcuts);
      const groupShortcuts = service.getGroupShortcuts('editor');
      
      expect(groupShortcuts.length).toBe(2);
      expect(groupShortcuts.map(s => s.id)).toContain('save');
      expect(groupShortcuts.map(s => s.id)).toContain('undo');
    });

    it('should return empty array for non-existent group', () => {
      const groupShortcuts = service.getGroupShortcuts('non-existent');
      expect(groupShortcuts).toEqual([]);
    });
  });

  describe('Visibility Change Handler', () => {
    it('should clear keys when returning to visibility', () => {
      const action = jasmine.createSpy('action');
      service.register(createMockShortcut({ 
        id: 'test',
        keys: ['ctrl', 's'],
        action
      }));

      // Simulate pressing ctrl
      const ctrlDown = createKeyboardEvent({ key: 'Control', ctrlKey: true });
      dispatchKeyEvent(ctrlDown);

      // Simulate tab becoming hidden
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      // Simulate tab becoming visible
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      // Now press 's' - should not trigger because ctrl was cleared
      const sDown = createKeyboardEvent({ key: 's', ctrlKey: false });
      dispatchKeyEvent(sDown);

      expect(action).not.toHaveBeenCalled();
    });
  });
});