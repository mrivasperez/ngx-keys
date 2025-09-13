import { Component, OnInit, OnDestroy } from '@angular/core';
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
    template: `
    <h2>Customize Keyboard Shortcuts</h2>
    <p>This page lets you record custom keyboard shortcuts for different actions.</p>
    
    <p><strong>Last Action:</strong> {{ actionService.lastAction() }}</p>
    <small>Total Actions: {{ actionService.count() }}</small>

    @if (recordingFor) {
      <section class="recording-status">
        <p><strong>🔴 Recording shortcut for:</strong> {{ recordingFor.name }}</p>
        <p><em>Press your desired key combination now...</em></p>
        <button (click)="cancelRecording()">Cancel</button>
      </section>
    }

    <section class="actions-list">
      <h3>Available Actions</h3>
      @for (action of actions; track action.id) {
        <article class="action-item">
          <div class="action-info">
            <h4>{{ action.name }}</h4>
            <p>{{ action.description }}</p>
            <div class="current-shortcut">
              <strong>Shortcut:</strong> 
              <kbd>{{ formatKeys(action.keys) }}</kbd>
            </div>
          </div>
          <div class="action-controls">
            <button (click)="recordShortcut(action)" [disabled]="!!recordingFor">
              {{ recordingFor?.id === action.id ? 'Recording...' : 'Record New' }}
            </button>
            <button (click)="triggerAction(action)">Test Action</button>
          </div>
        </article>
      }
    </section>

    <section class="instructions">
      <h3>How It Works</h3>
      <ol>
        <li>Click "Record New" next to any action</li>
        <li>Press your desired key combination (e.g., Ctrl+K, F2, Alt+S)</li>
        <li>The shortcut is immediately active and ready to use</li>
        <li>Try "Test Action" to trigger actions manually</li>
      </ol>
      
      <p><strong>Tip:</strong> Try combinations like Ctrl+1, Alt+H, or F5 for best results.</p>
    </section>
  `,
    styles: `
    .recording-status {
      background: #ffe6e6;
      border: 2px solid #ff4444;
      padding: 1rem;
      margin: 1rem 0;
    }

    .actions-list {
      margin: 2rem 0;
    }

    .action-item {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 1rem;
      border: 1px solid #ccc;
      margin: 1rem 0;
      gap: 1rem;
    }

    .action-info {
      flex: 1;
    }

    .action-info h4 {
      margin: 0 0 0.5rem 0;
    }

    .action-info p {
      margin: 0 0 0.5rem 0;
      color: #666;
    }

    .current-shortcut {
      font-size: 0.9em;
    }

    .action-controls {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .instructions {
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid #ccc;
    }

    @media (max-width: 768px) {
      .action-item {
        flex-direction: column;
      }
      
      .action-controls {
        flex-direction: row;
        justify-content: center;
      }
    }
  `
})
export class CustomizeComponent implements OnInit, OnDestroy {
    recordingFor: Action | null = null;

    actions: Action[] = [
        {
            id: 'save-document',
            name: 'Save Document',
            description: 'Save the current document or form',
            keys: ['ctrl', 's'],
            macKeys: ['meta', 's']
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

    constructor(
        private keyboardService: KeyboardShortcuts,
        protected actionService: ActionService
    ) { }

    ngOnInit() {
        // Register all actions with their keyboard shortcuts
        this.actions.forEach(action => this.registerAction(action));
        this.actionService.setAction('✅ Customize page loaded with 4 customizable actions');
    }

    ngOnDestroy() {
        this.cancelRecording();
        // Unregister all shortcuts when leaving the page
        this.actions.forEach(action => {
            if (this.keyboardService.isRegistered(action.id)) {
                this.keyboardService.unregister(action.id);
            }
        });
    }

    private registerAction(action: Action) {
        // Unregister first if already registered
        if (this.keyboardService.isRegistered(action.id)) {
            this.keyboardService.unregister(action.id);
        }

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
            // If there's a conflict, just register without the shortcut for now
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