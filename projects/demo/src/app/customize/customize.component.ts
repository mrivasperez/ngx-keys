import { Component, DestroyRef, inject, ChangeDetectionStrategy } from '@angular/core';
import { KeyboardShortcuts, KeyboardShortcut } from 'ngx-keys';
import { ActionService } from '../app';

interface Action {
    id: string;
    name: string;
    description: string;
    keys: string[];
    macKeys: string[];
}

@Component({
    selector: 'app-customize',
    imports: [],
    templateUrl: './customize.component.html',
    styleUrl: './customize.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomizeComponent {
    private readonly keyboardService = inject(KeyboardShortcuts);
    protected readonly actionService = inject(ActionService);
    private readonly destroyRef = inject(DestroyRef);

    recordingFor: Action | null = null;

    actions: Action[] = [
        {
            id: 'save-document',
            name: 'Save Document',
            description: 'Save the current document or form',
            keys: ['ctrl', 'shift', 's'],
            macKeys: ['meta', 'shift', 's']
        },
        {
            id: 'show-help',
            name: 'Show Help',
            description: 'Display help information',
            keys: ['f1'],
            macKeys: ['f1']
        },
        {
            id: 'quick-search',
            name: 'Quick Search',
            description: 'Open search functionality',
            keys: ['ctrl', 'k'],
            macKeys: ['meta', 'k']
        },
        {
            id: 'refresh-data',
            name: 'Refresh Data',
            description: 'Refresh the current page data',
            keys: ['f5'],
            macKeys: ['f5']
        }
    ];

    private keydownListener: ((e: KeyboardEvent) => void) | null = null;
    private keyupListener: ((e: KeyboardEvent) => void) | null = null;
    private groupRegistered = false;

    constructor() {
        // Register all actions as a group
        this.registerAllActions();
        this.actionService.setAction('✅ Customize page loaded with 4 customizable actions');

        // Setup cleanup on destroy
        this.destroyRef.onDestroy(() => {
            this.cancelRecording();
            // Only unregister the group if it was successfully registered
            if (this.groupRegistered) {
                try {
                    this.keyboardService.unregisterGroup('customize-actions');
                } catch (error) {
                    console.warn('Could not unregister customize actions group:', error);
                }
            }
        });
    }

    private registerAllActions() {
        // Don't register if already registered
        if (this.groupRegistered || this.keyboardService.isGroupRegistered('customize-actions')) {
            console.warn('Customize actions group is already registered');
            return;
        }

        const shortcuts: KeyboardShortcut[] = this.actions.map(action => ({
            id: action.id,
            keys: action.keys,
            macKeys: action.macKeys,
            description: action.description,
            action: () => this.executeAction(action)
        }));

        try {
            this.keyboardService.registerGroup('customize-actions', shortcuts);
            this.groupRegistered = true;
        } catch (error) {
            console.warn('Could not register customize actions group:', error);
            this.groupRegistered = false;
        }
    }

    private registerAction(action: Action) {
        // Unregister the existing shortcut if it exists
        if (this.keyboardService.isRegistered(action.id)) {
            this.keyboardService.unregister(action.id);
        }

        // Register the updated shortcut
        const shortcut: KeyboardShortcut = {
            id: action.id,
            keys: action.keys,
            macKeys: action.macKeys,
            description: action.description,
            action: () => this.executeAction(action)
        };

        try {
            this.keyboardService.register(shortcut);
        } catch (error) {
            console.warn(`Could not register shortcut for ${action.name}:`, error);
        }
    }

    recordShortcut(action: Action) {
        this.recordingFor = action;
        this.actionService.setAction(`🔴 Recording new shortcut for "${action.name}" - press and hold your key combination...`);

        let pressedKeys = new Set<string>();
        let keyupListener: ((e: KeyboardEvent) => void) | null = null;

        // Track keys being pressed down
        this.keydownListener = (event: KeyboardEvent) => {
            event.preventDefault();
            event.stopPropagation();

            // Add modifier keys
            if (event.ctrlKey) pressedKeys.add('ctrl');
            if (event.altKey) pressedKeys.add('alt');
            if (event.shiftKey) pressedKeys.add('shift');
            if (event.metaKey) pressedKeys.add('meta');

            // Add the main key (skip modifier keys themselves)
            const mainKey = event.key.toLowerCase();
            if (!['control', 'alt', 'shift', 'meta'].includes(mainKey)) {
                if (event.code.startsWith('F') && /^F\d+$/.test(event.code)) {
                    pressedKeys.add(event.code.toLowerCase());
                } else if (mainKey === 'escape') {
                    pressedKeys.add('escape');
                } else if (mainKey === 'enter') {
                    pressedKeys.add('enter');
                } else if (mainKey === ' ') {
                    pressedKeys.add('space');
                } else if (mainKey.length === 1 && /[a-z0-9]/.test(mainKey)) {
                    pressedKeys.add(mainKey);
                }
            }
        };

        // When keys are released, finalize the combination
        keyupListener = () => {
            // Small delay to ensure we capture the full combination
            setTimeout(() => {
                const keys = Array.from(pressedKeys);

                if (keys.length > 0) {
                    // Update the action with new keys
                    action.keys = keys;
                    action.macKeys = keys; // Using same keys for both in this demo

                    // Re-register the action with new keys
                    this.registerAction(action);

                    const keyStr = this.formatKeys(keys);
                    this.actionService.setAction(`✅ "${action.name}" shortcut updated to: ${keyStr}`);
                }

                this.cancelRecording();
            }, 100);
        };

        document.addEventListener('keydown', this.keydownListener, { capture: true });
        document.addEventListener('keyup', keyupListener, { capture: true });

        // Store keyup listener for cleanup
        this.keyupListener = keyupListener;
    }

    cancelRecording() {
        if (this.keydownListener) {
            document.removeEventListener('keydown', this.keydownListener, { capture: true });
            this.keydownListener = null;
        }
        if (this.keyupListener) {
            document.removeEventListener('keyup', this.keyupListener, { capture: true });
            this.keyupListener = null;
        }
        this.recordingFor = null;
    }

    triggerAction(action: Action) {
        this.executeAction(action);
    }

    private executeAction(action: Action) {
        const emojis = {
            'save-document': '💾',
            'show-help': '❓',
            'quick-search': '🔍',
            'refresh-data': '🔄'
        };

        const emoji = emojis[action.id as keyof typeof emojis] || '⚡';
        this.actionService.setAction(`${emoji} ${action.name} executed!`);
    }

    formatKeys(keys: string[]): string {
        if (keys.length === 0) return 'None';

        return keys.map(key => {
            switch (key.toLowerCase()) {
                case 'ctrl': return 'Ctrl';
                case 'alt': return 'Alt';
                case 'shift': return 'Shift';
                case 'meta': return '⌘';
                default: return key.charAt(0).toUpperCase() + key.slice(1);
            }
        }).join(' + ');
    }
}