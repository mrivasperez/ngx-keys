import {
  Directive,
  ElementRef,
  HostBinding,
  inject,
  Input,
  OnDestroy,
  OnInit,
  output,
} from '@angular/core';
import { KeyboardShortcuts } from '../core/keyboard-shortcuts.service';
import { Action, KeyStep } from '../models/keyboard-shortcut.interface';

/**
 * Directive for registering keyboard shortcuts directly on elements in templates.
 * 
 * This directive automatically:
 * - Registers the shortcut when the directive initializes
 * - Triggers the host element's click event (default) or executes a custom action
 * - Unregisters the shortcut when the component is destroyed
 * 
 * @example
 * Basic usage with click trigger:
 * ```html
 * <button ngxKeyboardShortcut
 *         keys="ctrl,s"
 *         description="Save document"
 *         (click)="save()">
 *   Save
 * </button>
 * ```
 * 
 * @example
 * With custom action:
 * ```html
 * <button ngxKeyboardShortcut
 *         keys="ctrl,s"
 *         description="Save document"
 *         [action]="customSaveAction">
 *   Save
 * </button>
 * ```
 * 
 * @example
 * Multi-step shortcuts:
 * ```html
 * <button ngxKeyboardShortcut
 *         [steps]="[['ctrl', 'k'], ['ctrl', 's']]"
 *         description="Format document"
 *         (click)="format()">
 *   Format
 * </button>
 * ```
 * 
 * @example
 * Mac-specific keys:
 * ```html
 * <button ngxKeyboardShortcut
 *         keys="ctrl,s"
 *         macKeys="cmd,s"
 *         description="Save document"
 *         (click)="save()">
 *   Save
 * </button>
 * ```
 * 
 * @example
 * On non-interactive elements:
 * ```html
 * <div ngxKeyboardShortcut
 *      keys="?"
 *      description="Show help"
 *      [action]="showHelp">
 *   Help content
 * </div>
 * ```
 */
@Directive({
  selector: '[ngxKeyboardShortcut]',
  standalone: true,
})
export class KeyboardShortcutDirective implements OnInit, OnDestroy {
  private readonly keyboardShortcuts = inject(KeyboardShortcuts);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  
  /**
   * Comma-separated string of keys for the shortcut (e.g., "ctrl,s" or "alt,shift,k")
   * Use either `keys` for single-step shortcuts or `steps` for multi-step shortcuts.
   */
  @Input() keys?: string;

  /**
   * Comma-separated string of keys for Mac users (e.g., "cmd,s")
   * If not provided, `keys` will be used for all platforms.
   */
  @Input() macKeys?: string;

  /**
   * Multi-step shortcut as an array of key arrays.
   * Each inner array represents one step in the sequence.
   * Example: [['ctrl', 'k'], ['ctrl', 's']] for Ctrl+K followed by Ctrl+S
   */
  @Input() steps?: KeyStep[];

  /**
   * Multi-step shortcut for Mac users.
   * Example: [['cmd', 'k'], ['cmd', 's']]
   */
  @Input() macSteps?: KeyStep[];

  /**
   * Description of what the shortcut does (displayed in help/documentation)
   */
  @Input({ required: true }) description!: string;

  /**
   * Optional custom action to execute when the shortcut is triggered.
   * If not provided, the directive will trigger a click event on the host element.
   */
  @Input() action?: Action;

  /**
   * Optional custom ID for the shortcut. If not provided, a unique ID will be generated.
   * Useful for programmatically referencing the shortcut or for debugging.
   */
  @Input() shortcutId?: string;

  /**
   * Event emitted when the keyboard shortcut is triggered.
   * This fires in addition to the action or click trigger.
   */
  readonly triggered = output<void>();

  /**
   * Adds a data attribute to the host element for styling or testing purposes
   */
  @HostBinding('attr.data-keyboard-shortcut')
  get dataAttribute(): string {
    return this.generatedId;
  }

  private generatedId = '';
  private isRegistered = false;

  ngOnInit(): void {
    // Generate unique ID if not provided
    this.generatedId = this.shortcutId || this.generateUniqueId();

    // Validate inputs
    this.validateInputs();

    // Parse keys from comma-separated strings
    const parsedKeys = this.keys ? this.parseKeys(this.keys) : undefined;
    const parsedMacKeys = this.macKeys ? this.parseKeys(this.macKeys) : undefined;

    // Define the action: custom action or default click behavior
    const shortcutAction: Action = () => {
      if (this.action) {
        this.action();
      } else {
        // Trigger click on the host element
        this.elementRef.nativeElement.click();
      }
      // Emit the triggered event
      this.triggered.emit();
    };

    // Register the shortcut
    try {
      this.keyboardShortcuts.register({
        id: this.generatedId,
        keys: parsedKeys,
        macKeys: parsedMacKeys,
        steps: this.steps,
        macSteps: this.macSteps,
        action: shortcutAction,
        description: this.description,
      });
      this.isRegistered = true;
    } catch (error) {
      console.error(`[ngxKeyboardShortcut] Failed to register shortcut:`, error);
      throw error;
    }
  }

  ngOnDestroy(): void {
    // Automatically unregister the shortcut when the directive is destroyed
    if (this.isRegistered) {
      try {
        this.keyboardShortcuts.unregister(this.generatedId);
      } catch (error) {
        // Silently handle unregister errors (shortcut might have been manually removed)
        console.warn(`[ngxKeyboardShortcut] Failed to unregister shortcut ${this.generatedId}:`, error);
      }
    }
  }

  /**
   * Parse comma-separated key string into an array
   * Example: "ctrl,s" -> ["ctrl", "s"]
   */
  private parseKeys(keysString: string): string[] {
    return keysString
      .split(',')
      .map(key => key.trim())
      .filter(key => key.length > 0);
  }

  /**
   * Generate a unique ID for the shortcut based on the element and keys
   */
  private generateUniqueId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const keysStr = this.keys || this.steps?.flat().join('-') || 'unknown';
    return `ngx-shortcut-${keysStr}-${timestamp}-${random}`;
  }

  /**
   * Validate that required inputs are provided correctly
   */
  private validateInputs(): void {
    const hasSingleStep = this.keys || this.macKeys;
    const hasMultiStep = this.steps || this.macSteps;

    if (!hasSingleStep && !hasMultiStep) {
      throw new Error(
        `[ngxKeyboardShortcut] Must provide either 'keys'/'macKeys' for single-step shortcuts or 'steps'/'macSteps' for multi-step shortcuts.`
      );
    }

    if (hasSingleStep && hasMultiStep) {
      throw new Error(
        `[ngxKeyboardShortcut] Cannot use both single-step ('keys'/'macKeys') and multi-step ('steps'/'macSteps') inputs simultaneously. Choose one approach.`
      );
    }

    if (!this.description) {
      throw new Error(
        `[ngxKeyboardShortcut] 'description' input is required.`
      );
    }
  }
}
