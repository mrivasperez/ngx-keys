import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { KeyboardShortcuts, KeyboardShortcut, KeyboardShortcutUI } from 'ngx-keys';
import { ActionService } from '../app';

@Component({
  selector: 'app-feature',
  imports: [],
  template: `
    <h2>Feature Page</h2>
    <p>This page has its own set of keyboard shortcuts that are only active when you're on this route.</p>
    
    <p><strong>Last Action:</strong> {{ actionService.lastAction() }}</p>
    <small>Total Actions: {{ actionService.count() }}</small>

    <section class="controls">
      <button (click)="toggleFeatureGroup()">
        Toggle Feature Shortcuts ({{ getFeatureGroupStatus() }})
      </button>
      <button (click)="refreshData()">
        Refresh Data (F5)
      </button>
    </section>

    <section>
      <h3>Feature-Specific Shortcuts:</h3>
      <ul>
        <li><kbd>F1</kbd> - Show feature help</li>
        <li><kbd>F5</kbd> - Refresh data</li>
        <li><kbd>Ctrl+D</kbd> / <kbd>⌘+D</kbd> - Delete item</li>
        <li><kbd>Escape</kbd> - Cancel operation</li>
      </ul>
    </section>

    <section class="shortcuts-display">
      <fieldset>
        <legend>🟢 Active Feature Shortcuts ({{ activeFeatureShortcuts().length }})</legend>
        @if (activeFeatureShortcuts().length > 0) {
          <ol>
            @for (shortcut of activeFeatureShortcuts(); track shortcut.id) {
              <li>
                <kbd>{{ shortcut.keys }}</kbd> - {{ shortcut.description }}
              </li>
            }
          </ol>
        } @else {
          <p><em>No active feature shortcuts</em></p>
        }
      </fieldset>

      <fieldset>
        <legend>📊 All Active Shortcuts ({{ allActiveShortcuts().length }})</legend>
        <small>Including shortcuts from other routes</small>
        @if (allActiveShortcuts().length > 0) {
          <ol>
            @for (shortcut of allActiveShortcuts(); track shortcut.id) {
              <li>
                <kbd>{{ shortcut.keys }}</kbd> - {{ shortcut.description }}
                @if (shortcut.macKeys !== shortcut.keys) {
                  <br><small>Mac: <kbd>{{ shortcut.macKeys }}</kbd></small>
                }
              </li>
            }
          </ol>
        } @else {
          <p><em>No active shortcuts</em></p>
        }
      </fieldset>
    </section>
  `,
  styles: ``
})
export class FeatureComponent implements OnInit, OnDestroy {
  // Reactive signals from the keyboard service
  protected readonly allActiveShortcuts;
  protected readonly activeFeatureShortcuts;

  constructor(
    private keyboardService: KeyboardShortcuts,
    protected actionService: ActionService
  ) {
    this.allActiveShortcuts = () => this.keyboardService.shortcutsUI$().active;
    // Filter for feature-specific shortcuts
    this.activeFeatureShortcuts = () => {
      return this.keyboardService.shortcutsUI$().active.filter((shortcut: KeyboardShortcutUI) => 
        shortcut.id.startsWith('feature-')
      );
    };
  }

  ngOnInit() {
    // Register feature-specific shortcuts that are only active on this route
    const featureShortcuts: KeyboardShortcut[] = [
      {
        id: 'feature-help',
        keys: ['f1'],
        macKeys: ['f1'],
        action: () => this.showFeatureHelp(),
        description: 'Show feature help'
      },
      {
        id: 'feature-refresh',
        keys: ['f5'],
        macKeys: ['f5'],
        action: () => this.refreshData(),
        description: 'Refresh data'
      },
      {
        id: 'feature-delete',
        keys: ['ctrl', 'd'],
        macKeys: ['meta', 'd'],
        action: () => this.deleteItem(),
        description: 'Delete item'
      },
      {
        id: 'feature-cancel',
        keys: ['escape'],
        macKeys: ['escape'],
        action: () => this.cancelOperation(),
        description: 'Cancel operation'
      }
    ];

    this.keyboardService.registerGroup('feature-shortcuts', featureShortcuts);
    this.actionService.setAction('✅ Feature shortcuts activated!');
  }

  ngOnDestroy() {
    // Clean up feature-specific shortcuts when leaving this route
    this.keyboardService.unregisterGroup('feature-shortcuts');
  }

  private showFeatureHelp() {
    this.actionService.setAction('❓ Feature help displayed!');
  }

  protected refreshData() {
    this.actionService.setAction('🔄 Data refreshed!');
  }

  private deleteItem() {
    this.actionService.setAction('🗑️ Item deleted!');
  }

  private cancelOperation() {
    this.actionService.setAction('❌ Operation cancelled!');
  }

  protected toggleFeatureGroup() {
    const isActive = this.keyboardService.isGroupActive('feature-shortcuts');
    if (isActive) {
      this.keyboardService.deactivateGroup('feature-shortcuts');
      this.actionService.setAction('🚫 Feature shortcuts disabled');
    } else {
      this.keyboardService.activateGroup('feature-shortcuts');
      this.actionService.setAction('✅ Feature shortcuts enabled');
    }
  }

  protected getFeatureGroupStatus(): string {
    return this.keyboardService.isGroupActive('feature-shortcuts') ? '✅ Active' : '❌ Inactive';
  }
}
