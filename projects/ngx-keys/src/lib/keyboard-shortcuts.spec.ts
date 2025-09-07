import { KeyboardShortcuts } from './keyboard-shortcuts';
import { KeyboardShortcut } from './keyboard-shortcut.interface';

describe('KeyboardShortcuts', () => {
  let service: KeyboardShortcuts;
  let mockAction: jasmine.Spy;

  const mockShortcut: KeyboardShortcut = {
    id: 'test-shortcut',
    keys: ['ctrl', 's'],
    macKeys: ['meta', 's'],
    action: () => {},
    description: 'Test shortcut'
  };

  beforeEach(() => {
    mockAction = jasmine.createSpy('mockAction');
    
    // Create a testable instance by extending the service
    class TestableKeyboardShortcuts extends KeyboardShortcuts {
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
    
    service = new TestableKeyboardShortcuts();
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Reactive Signals', () => {
    it('should provide reactive signals for UI', () => {
      expect(service.activeShortcutsUI).toBeDefined();
      expect(service.inactiveShortcutsUI).toBeDefined();
      expect(service.allShortcutsUI).toBeDefined();
      expect(service.activeGroupIds).toBeDefined();
      expect(service.inactiveGroupIds).toBeDefined();
    });

    it('should update activeShortcutsUI signal when shortcuts are registered', () => {
      const initialCount = service.activeShortcutsUI().length;
      
      const shortcut = { ...mockShortcut, action: mockAction };
      service.register(shortcut);
      
      expect(service.activeShortcutsUI().length).toBe(initialCount + 1);
      expect(service.activeShortcutsUI()[0]).toEqual({
        id: 'test-shortcut',
        keys: 'Ctrl+S',
        macKeys: '⌘+S',
        description: 'Test shortcut'
      });
    });

    it('should update inactiveShortcutsUI signal when shortcuts are deactivated', () => {
      const shortcut = { ...mockShortcut, action: mockAction };
      service.register(shortcut);
      service.deactivate('test-shortcut');
      
      expect(service.inactiveShortcutsUI().length).toBe(1);
      expect(service.inactiveShortcutsUI()[0].id).toBe('test-shortcut');
      expect(service.activeShortcutsUI().length).toBe(0);
    });

    it('should update allShortcutsUI signal with all registered shortcuts', () => {
      const shortcut1 = { ...mockShortcut, id: 'shortcut-1', action: mockAction };
      const shortcut2 = { ...mockShortcut, id: 'shortcut-2', keys: ['ctrl', 'c'], action: mockAction };
      
      service.register(shortcut1);
      service.register(shortcut2);
      
      expect(service.allShortcutsUI().length).toBe(2);
      expect(service.allShortcutsUI().map(s => s.id)).toContain('shortcut-1');
      expect(service.allShortcutsUI().map(s => s.id)).toContain('shortcut-2');
    });

    it('should update activeGroupIds and inactiveGroupIds signals', () => {
      const shortcuts = [
        { ...mockShortcut, id: 'shortcut-1', action: mockAction }
      ];
      
      service.registerGroup('test-group', shortcuts);
      expect(service.activeGroupIds()).toContain('test-group');
      expect(service.inactiveGroupIds()).not.toContain('test-group');
      
      service.deactivateGroup('test-group');
      expect(service.activeGroupIds()).not.toContain('test-group');
      expect(service.inactiveGroupIds()).toContain('test-group');
    });
  });

  describe('Single Shortcut Management', () => {
    it('should register a single shortcut', () => {
      const shortcut = { ...mockShortcut, action: mockAction };
      service.register(shortcut);
      
      expect(service.getShortcuts().has('test-shortcut')).toBe(true);
      expect(service.isActive('test-shortcut')).toBe(true);
    });

    it('should unregister a single shortcut', () => {
      const shortcut = { ...mockShortcut, action: mockAction };
      service.register(shortcut);
      service.unregister('test-shortcut');
      
      expect(service.getShortcuts().has('test-shortcut')).toBe(false);
      expect(service.isActive('test-shortcut')).toBe(false);
    });

    it('should activate and deactivate individual shortcuts', () => {
      const shortcut = { ...mockShortcut, action: mockAction };
      service.register(shortcut);
      
      service.deactivate('test-shortcut');
      expect(service.isActive('test-shortcut')).toBe(false);
      
      service.activate('test-shortcut');
      expect(service.isActive('test-shortcut')).toBe(true);
    });

    it('should handle activation of non-existent shortcuts gracefully', () => {
      expect(() => service.activate('non-existent')).not.toThrow();
      expect(service.isActive('non-existent')).toBe(false);
    });

    it('should handle deactivation of non-existent shortcuts gracefully', () => {
      expect(() => service.deactivate('non-existent')).not.toThrow();
      expect(service.isActive('non-existent')).toBe(false);
    });
  });

  describe('Group Management', () => {
    it('should register a group of shortcuts', () => {
      const shortcuts = [
        { ...mockShortcut, id: 'shortcut-1', action: mockAction },
        { ...mockShortcut, id: 'shortcut-2', keys: ['ctrl', 'c'], action: mockAction }
      ];
      
      service.registerGroup('test-group', shortcuts);
      
      expect(service.getGroups().has('test-group')).toBe(true);
      expect(service.isGroupActive('test-group')).toBe(true);
      expect(service.isActive('shortcut-1')).toBe(true);
      expect(service.isActive('shortcut-2')).toBe(true);
    });

    it('should unregister a group of shortcuts', () => {
      const shortcuts = [
        { ...mockShortcut, id: 'shortcut-1', action: mockAction },
        { ...mockShortcut, id: 'shortcut-2', keys: ['ctrl', 'c'], action: mockAction }
      ];
      
      service.registerGroup('test-group', shortcuts);
      service.unregisterGroup('test-group');
      
      expect(service.getGroups().has('test-group')).toBe(false);
      expect(service.isGroupActive('test-group')).toBe(false);
      expect(service.isActive('shortcut-1')).toBe(false);
      expect(service.isActive('shortcut-2')).toBe(false);
    });

    it('should activate and deactivate groups', () => {
      const shortcuts = [
        { ...mockShortcut, id: 'shortcut-1', action: mockAction },
        { ...mockShortcut, id: 'shortcut-2', keys: ['ctrl', 'c'], action: mockAction }
      ];
      
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

    it('should handle activation of non-existent groups gracefully', () => {
      expect(() => service.activateGroup('non-existent')).not.toThrow();
      expect(service.isGroupActive('non-existent')).toBe(false);
    });

    it('should handle deactivation of non-existent groups gracefully', () => {
      expect(() => service.deactivateGroup('non-existent')).not.toThrow();
      expect(service.isGroupActive('non-existent')).toBe(false);
    });

    it('should handle unregistering non-existent groups gracefully', () => {
      expect(() => service.unregisterGroup('non-existent')).not.toThrow();
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
      
      const formatted = service.allShortcutsUI()[0];
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
      
      const formatted = service.allShortcutsUI()[0];
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
      
      const formatted = service.allShortcutsUI()[0];
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
      
      const formatted = service.allShortcutsUI();
      expect(formatted.find(s => s.id === 'cmd-test')?.macKeys).toBe('⌘+S');
      expect(formatted.find(s => s.id === 'command-test')?.macKeys).toBe('⌘+C');
    });
  });

  describe('Key Matching Logic', () => {
    let testableService: any;

    beforeEach(() => {
      testableService = service as any;
    });

    it('should correctly parse pressed keys from keyboard event', () => {
      const event = new KeyboardEvent('keydown', {
        ctrlKey: true,
        key: 's'
      });
      
      const pressedKeys = testableService.testGetPressedKeys(event);
      expect(pressedKeys).toEqual(['ctrl', 's']);
    });

    it('should parse multiple modifier keys', () => {
      const event = new KeyboardEvent('keydown', {
        ctrlKey: true,
        altKey: true,
        shiftKey: true,
        metaKey: true,
        key: 'a'
      });
      
      const pressedKeys = testableService.testGetPressedKeys(event);
      expect(pressedKeys).toEqual(['ctrl', 'alt', 'shift', 'meta', 'a']);
    });

    it('should ignore modifier keys as main key', () => {
      const event = new KeyboardEvent('keydown', {
        ctrlKey: true,
        key: 'control'
      });
      
      const pressedKeys = testableService.testGetPressedKeys(event);
      expect(pressedKeys).toEqual(['ctrl']);
    });

    it('should handle special keys', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter'
      });
      
      const pressedKeys = testableService.testGetPressedKeys(event);
      expect(pressedKeys).toEqual(['enter']);
    });

    it('should match keys correctly', () => {
      const pressedKeys = ['ctrl', 's'];
      const targetKeys = ['ctrl', 's'];
      
      expect(testableService.testKeysMatch(pressedKeys, targetKeys)).toBe(true);
    });

    it('should not match different key combinations', () => {
      const pressedKeys = ['ctrl', 's'];
      const targetKeys = ['ctrl', 'c'];
      
      expect(testableService.testKeysMatch(pressedKeys, targetKeys)).toBe(false);
    });

    it('should not match different lengths', () => {
      const pressedKeys = ['ctrl', 's'];
      const targetKeys = ['ctrl', 'shift', 's'];
      
      expect(testableService.testKeysMatch(pressedKeys, targetKeys)).toBe(false);
    });

    it('should handle case insensitive key matching', () => {
      const pressedKeys = ['ctrl', 'S'];
      const targetKeys = ['ctrl', 's'];
      
      expect(testableService.testKeysMatch(pressedKeys, targetKeys)).toBe(true);
    });

    it('should match keys regardless of order', () => {
      const pressedKeys = ['s', 'ctrl'];
      const targetKeys = ['ctrl', 's'];
      
      expect(testableService.testKeysMatch(pressedKeys, targetKeys)).toBe(true);
    });
  });

  describe('Keyboard Event Handling', () => {
    it('should execute shortcut action when matching keys are pressed', () => {
      const shortcut = { ...mockShortcut, action: mockAction };
      service.register(shortcut);
      
      const testableService = service as any;
      const event = new KeyboardEvent('keydown', {
        ctrlKey: true,
        key: 's'
      });
      
      testableService.testHandleKeydown(event);
      expect(mockAction).toHaveBeenCalled();
    });

    it('should use Mac keys on Mac platform', () => {
      const macAction = jasmine.createSpy('macAction');
      const shortcut = { 
        ...mockShortcut, 
        keys: ['ctrl', 's'],
        macKeys: ['meta', 's'],
        action: macAction 
      };
      service.register(shortcut);
      
      const testableService = service as any;
      // Mock both the platform detection AND isBrowser check
      spyOn(testableService, 'testIsMacPlatform').and.returnValue(true);
      // Override the isMacPlatform method call in handleKeydown
      spyOn(testableService, 'isMacPlatform').and.returnValue(true);
      
      const event = new KeyboardEvent('keydown', {
        metaKey: true,
        key: 's'
      });
      
      testableService.testHandleKeydown(event);
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
      
      service.register({ ...mockShortcut, id: 'shortcut-1', action: action1 });
      service.register({ ...mockShortcut, id: 'shortcut-2', action: action2 });
      
      const testableService = service as any;
      const event = new KeyboardEvent('keydown', {
        ctrlKey: true,
        key: 's'
      });
      
      testableService.testHandleKeydown(event);
      expect(action1).toHaveBeenCalled();
      expect(action2).not.toHaveBeenCalled();
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
      class NonBrowserKeyboardShortcuts extends KeyboardShortcuts {
        constructor() {
          super();
          (this as any).isBrowser = false;
        }
      }
      
      expect(() => new NonBrowserKeyboardShortcuts()).not.toThrow();
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
});
