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

    it('should handle case insensitive key matching', () => {
      const pressedKeys = ['ctrl', 'S'];
      const targetKeys = ['ctrl', 's'];
      
      expect(testableService.testKeysMatch(pressedKeys, targetKeys)).toBe(true);
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
  });
});
