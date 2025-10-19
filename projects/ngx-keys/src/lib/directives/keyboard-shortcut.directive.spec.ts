import { Component, DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import * as ngCore from '@angular/core';
import { KeyboardShortcutDirective } from './keyboard-shortcut.directive';
import { KeyboardShortcuts } from '../core/keyboard-shortcuts.service';
import { createKeyboardEvent, dispatchKeyEvent } from '../testing/test-utils';
import { KeyboardShortcutsErrors } from '../errors/keyboard-shortcuts.errors';

@Component({
  selector: 'test-host',
  standalone: true,
  imports: [KeyboardShortcutDirective],
  template: `
    <button
      #testButton
      ngxKeys
      [keys]="keys"
      [macKeys]="macKeys"
      [steps]="steps"
      [macSteps]="macSteps"
      [description]="description"
      [action]="action"
      [shortcutId]="shortcutId"
      (triggered)="onTriggered()"
      (click)="onClick()">
      Test Button
    </button>
  `,
})
class TestHostComponent {
  keys?: string;
  macKeys?: string;
  steps?: string[][];
  macSteps?: string[][];
  description = 'Test shortcut';
  action?: () => void;
  shortcutId?: string;

  clickCount = 0;
  triggeredCount = 0;

  onClick(): void {
    this.clickCount++;
  }

  onTriggered(): void {
    this.triggeredCount++;
  }
}

describe('KeyboardShortcutDirective', () => {
  let component: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;
  let directiveElement: DebugElement;
  let service: KeyboardShortcuts;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [ngCore.provideZonelessChangeDetection(), KeyboardShortcuts],
      imports: [TestHostComponent],
    });

    service = TestBed.inject(KeyboardShortcuts);

    // Allow a microtask tick for the service to perform any async setup
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  afterEach(() => {
    if (fixture) {
      fixture.destroy();
    }
    service.ngOnDestroy();
  });

  function createFixture(): ComponentFixture<TestHostComponent> {
    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    return fixture;
  }

  describe('Initialization', () => {
    it('should create the directive', () => {
      createFixture();
      component.keys = 'ctrl,s';
      fixture.detectChanges();

      directiveElement = fixture.debugElement.query(By.directive(KeyboardShortcutDirective));
      expect(directiveElement).toBeTruthy();
    });

    it('should register shortcut on initialization', () => {
      createFixture();
      component.keys = 'ctrl,s';
      fixture.detectChanges();

      const shortcuts = service.getShortcuts();
      expect(shortcuts.size).toBe(1);
    });

    it('should add data attribute to host element', () => {
      createFixture();
      component.keys = 'ctrl,s';
      component.shortcutId = 'test-id';
      fixture.detectChanges();

      const button = fixture.debugElement.query(By.css('button'));
      expect(button.nativeElement.getAttribute('data-keyboard-shortcut')).toBe('test-id');
    });

    it('should generate unique ID when shortcutId is not provided', () => {
      createFixture();
      component.keys = 'ctrl,s';
      fixture.detectChanges();

      const button = fixture.debugElement.query(By.css('button'));
      const attr = button.nativeElement.getAttribute('data-keyboard-shortcut');
      expect(attr).toBeTruthy();
      expect(attr).toMatch(/^ngx-shortcut-ctrl,s-\d+-[a-z0-9]+$/);
    });

    it('should use provided shortcutId', () => {
      createFixture();
      component.keys = 'ctrl,s';
      component.shortcutId = 'custom-id';
      fixture.detectChanges();

      expect(service.isRegistered('custom-id')).toBe(true);
    });
  });

  describe('Input Validation', () => {
    it('should throw error when no keys or steps are provided', () => {
      expect(() => {
        createFixture();
        fixture.detectChanges();
      }).toThrowError(/Must provide either 'keys'\/\'macKeys' for single-step shortcuts/);
    });

    it('should throw error when both keys and steps are provided', () => {
      createFixture();
      component.keys = 'ctrl,s';
      component.steps = [['ctrl', 'k'], ['s']];

      expect(() => {
        fixture.detectChanges();
      }).toThrowError(/Cannot use both single-step/);
    });

    it('should accept keys without macKeys', () => {
      createFixture();
      component.keys = 'ctrl,s';
      expect(() => {
        fixture.detectChanges();
      }).not.toThrow();
    });

    it('should accept macKeys without keys', () => {
      createFixture();
      component.macKeys = 'cmd,s';
      expect(() => {
        fixture.detectChanges();
      }).not.toThrow();
    });

    it('should accept steps without macSteps', () => {
      createFixture();
      component.steps = [['ctrl', 'k'], ['s']];
      expect(() => {
        fixture.detectChanges();
      }).not.toThrow();
    });

    it('should accept macSteps without steps', () => {
      createFixture();
      component.macSteps = [['cmd', 'k'], ['s']];
      expect(() => {
        fixture.detectChanges();
      }).not.toThrow();
    });
  });

  describe('Key Parsing', () => {
    it('should parse comma-separated keys correctly', () => {
      createFixture();
      component.keys = 'ctrl,shift,s';
      component.shortcutId = 'parse-test';
      fixture.detectChanges();

      const shortcuts = service.getShortcuts();
      const shortcut = shortcuts.get('parse-test');
      expect(shortcut?.keys).toEqual(['ctrl', 'shift', 's']);
    });

    it('should trim whitespace from keys', () => {
      createFixture();
      component.keys = ' ctrl , shift , s ';
      component.shortcutId = 'trim-test';
      fixture.detectChanges();

      const shortcuts = service.getShortcuts();
      const shortcut = shortcuts.get('trim-test');
      expect(shortcut?.keys).toEqual(['ctrl', 'shift', 's']);
    });

    it('should handle single key', () => {
      createFixture();
      component.keys = 's';
      component.shortcutId = 'single-key-test';
      fixture.detectChanges();

      const shortcuts = service.getShortcuts();
      const shortcut = shortcuts.get('single-key-test');
      expect(shortcut?.keys).toEqual(['s']);
    });

    it('should filter out empty keys', () => {
      createFixture();
      component.keys = 'ctrl,,s';
      component.shortcutId = 'empty-test';
      fixture.detectChanges();

      const shortcuts = service.getShortcuts();
      const shortcut = shortcuts.get('empty-test');
      expect(shortcut?.keys).toEqual(['ctrl', 's']);
    });
  });

  describe('Default Click Action', () => {
    it('should trigger click on host element when shortcut is pressed', async () => {
      createFixture();
      component.keys = 'ctrl,s';
      fixture.detectChanges();

      // Dispatch keyboard event
      const event = createKeyboardEvent({ key: 's', ctrlKey: true });
      dispatchKeyEvent(event);

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(component.clickCount).toBe(1);
    });

    it('should emit triggered event when shortcut is pressed', async () => {
      createFixture();
      component.keys = 'ctrl,s';
      fixture.detectChanges();

      const event = createKeyboardEvent({ key: 's', ctrlKey: true });
      dispatchKeyEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(component.triggeredCount).toBe(1);
    });

    it('should trigger both click and triggered event', async () => {
      createFixture();
      component.keys = 'alt,k';
      fixture.detectChanges();

      const event = createKeyboardEvent({ key: 'k', altKey: true });
      dispatchKeyEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(component.clickCount).toBe(1);
      expect(component.triggeredCount).toBe(1);
    });
  });

  describe('Custom Action', () => {
    it('should execute custom action instead of click when provided', async () => {
      let customActionCalled = false;
      createFixture();
      component.action = () => {
        customActionCalled = true;
      };
      component.keys = 'ctrl,s';
      fixture.detectChanges();

      const event = createKeyboardEvent({ key: 's', ctrlKey: true });
      dispatchKeyEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(customActionCalled).toBe(true);
      expect(component.clickCount).toBe(0); // Click should not be triggered
    });

    it('should still emit triggered event with custom action', async () => {
      createFixture();
      component.action = () => {};
      component.keys = 'ctrl,s';
      fixture.detectChanges();

      const event = createKeyboardEvent({ key: 's', ctrlKey: true });
      dispatchKeyEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(component.triggeredCount).toBe(1);
    });
  });

  describe('Mac Keys', () => {
    it('should register macKeys when provided', () => {
      createFixture();
      component.keys = 'ctrl,s';
      component.macKeys = 'cmd,s';
      component.shortcutId = 'mac-test';
      fixture.detectChanges();

      const shortcuts = service.getShortcuts();
      const shortcut = shortcuts.get('mac-test');
      expect(shortcut?.macKeys).toEqual(['cmd', 's']);
    });

    it('should parse macKeys correctly', () => {
      createFixture();
      component.macKeys = 'cmd,shift,s';
      component.shortcutId = 'mac-parse-test';
      fixture.detectChanges();

      const shortcuts = service.getShortcuts();
      const shortcut = shortcuts.get('mac-parse-test');
      expect(shortcut?.macKeys).toEqual(['cmd', 'shift', 's']);
    });
  });

  describe('Multi-Step Shortcuts', () => {
    it('should register multi-step shortcut', () => {
      createFixture();
      component.steps = [['ctrl', 'k'], ['s']];
      component.shortcutId = 'multi-step-test';
      fixture.detectChanges();

      const shortcuts = service.getShortcuts();
      const shortcut = shortcuts.get('multi-step-test');
      expect(shortcut?.steps).toEqual([['ctrl', 'k'], ['s']]);
    });

    it('should register macSteps for multi-step shortcuts', () => {
      createFixture();
      component.steps = [['ctrl', 'k'], ['s']];
      component.macSteps = [['cmd', 'k'], ['s']];
      component.shortcutId = 'mac-multi-step-test';
      fixture.detectChanges();

      const shortcuts = service.getShortcuts();
      const shortcut = shortcuts.get('mac-multi-step-test');
      expect(shortcut?.macSteps).toEqual([['cmd', 'k'], ['s']]);
    });

    it('should trigger action on multi-step shortcut completion', async () => {
      createFixture();
      component.steps = [['ctrl', 'k'], ['s']];
      fixture.detectChanges();

      // First step
      const event1 = createKeyboardEvent({ key: 'k', ctrlKey: true });
      dispatchKeyEvent(event1);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Second step
      const event2 = createKeyboardEvent({ key: 's' });
      dispatchKeyEvent(event2);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(component.clickCount).toBe(1);
      expect(component.triggeredCount).toBe(1);
    });

    it('should execute custom action for multi-step shortcuts', async () => {
      let customActionCalled = false;
      createFixture();
      component.action = () => {
        customActionCalled = true;
      };
      component.steps = [['ctrl', 'k'], ['ctrl', 's']];
      fixture.detectChanges();

      // First step
      const event1 = createKeyboardEvent({ key: 'k', ctrlKey: true });
      dispatchKeyEvent(event1);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Second step
      const event2 = createKeyboardEvent({ key: 's', ctrlKey: true });
      dispatchKeyEvent(event2);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(customActionCalled).toBe(true);
      expect(component.clickCount).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should unregister shortcut on destroy', () => {
      createFixture();
      component.keys = 'ctrl,s';
      component.shortcutId = 'cleanup-test';
      fixture.detectChanges();

      expect(service.isRegistered('cleanup-test')).toBe(true);

      fixture.destroy();

      expect(service.isRegistered('cleanup-test')).toBe(false);
    });

    it('should handle unregister errors gracefully', () => {
      createFixture();
      component.keys = 'ctrl,s';
      component.shortcutId = 'error-test';
      fixture.detectChanges();

      // Manually unregister to cause an error on destroy
      service.unregister('error-test');

      // Should not throw
      expect(() => {
        fixture.destroy();
      }).not.toThrow();
    });
  });

  describe('Description', () => {
    it('should pass description to service', () => {
      createFixture();
      component.keys = 'ctrl,s';
      component.description = 'Save document';
      component.shortcutId = 'desc-test';
      fixture.detectChanges();

      const shortcuts = service.getShortcuts();
      const shortcut = shortcuts.get('desc-test');
      expect(shortcut?.description).toBe('Save document');
    });

    it('should update UI signal with description', () => {
      createFixture();
      component.keys = 'ctrl,s';
      component.description = 'Test Description';
      fixture.detectChanges();

      const ui = service.shortcutsUI$();
      expect(ui.active.some(s => s.description === 'Test Description')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw and propagate registration errors', () => {
      createFixture();
      component.keys = 'ctrl,s';
      component.shortcutId = 'error-test';
      fixture.detectChanges();

      // Try to register duplicate
      expect(() => {
        const newFixture = TestBed.createComponent(TestHostComponent);
        newFixture.componentInstance.keys = 'ctrl,s';
        newFixture.componentInstance.shortcutId = 'error-test';
        newFixture.detectChanges();
      }).toThrowError();
    });
  });

  describe('Integration with KeyboardShortcuts Service', () => {
    it('should be deactivatable via service', async () => {
      createFixture();
      component.keys = 'ctrl,s';
      component.shortcutId = 'deactivate-test';
      fixture.detectChanges();

      service.deactivate('deactivate-test');

      const event = createKeyboardEvent({ key: 's', ctrlKey: true });
      dispatchKeyEvent(event);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(component.clickCount).toBe(0);
    });

    it('should be reactivatable via service', async () => {
      createFixture();
      component.keys = 'ctrl,s';
      component.shortcutId = 'reactivate-test';
      fixture.detectChanges();

      service.deactivate('reactivate-test');
      service.activate('reactivate-test');

      const event = createKeyboardEvent({ key: 's', ctrlKey: true });
      dispatchKeyEvent(event);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(component.clickCount).toBe(1);
    });

    it('should appear in shortcuts$ signal', () => {
      createFixture();
      component.keys = 'ctrl,s';
      component.shortcutId = 'signal-test';
      fixture.detectChanges();

      const shortcuts = service.shortcuts$();
      expect(shortcuts.active.some(s => s.id === 'signal-test')).toBe(true);
    });
  });

  describe('Non-Interactive Elements', () => {
    @Component({
      selector: 'test-div-host',
      standalone: true,
      imports: [KeyboardShortcutDirective],
      template: `
        <div
          ngxKeys
          keys="?"
          description="Show help"
          [action]="action"
          (triggered)="onTriggered()">
          Help content
        </div>
      `,
    })
    class TestDivHostComponent {
      action?: () => void;
      triggeredCount = 0;

      onTriggered(): void {
        this.triggeredCount++;
      }
    }

    it('should work on non-interactive elements with custom action', async () => {
      const divFixture = TestBed.createComponent(TestDivHostComponent);
      const divComponent = divFixture.componentInstance;
      let customActionCalled = false;
      divComponent.action = () => {
        customActionCalled = true;
      };
      divFixture.detectChanges();

      const event = createKeyboardEvent({ key: '?' });
      dispatchKeyEvent(event);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(customActionCalled).toBe(true);
      expect(divComponent.triggeredCount).toBe(1);
    });
  });
});
