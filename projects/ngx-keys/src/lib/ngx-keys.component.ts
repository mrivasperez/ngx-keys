import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KeyboardShortcuts } from './keyboard-shortcuts';

@Component({
  selector: 'ngx-keys',
  imports: [CommonModule],
  template: `
    <div class="keyboard-shortcuts">
      <h3>Active Keyboard Shortcuts</h3>
      <div class="shortcuts-grid">
        @for (shortcut of keyboardShortcuts.activeShortcutsUI(); track shortcut.keys) {
          <div class="shortcut-item">
            <span class="keys">{{ shortcut.keys }}</span>
            <span class="mac-keys" *ngIf="shortcut.macKeys !== shortcut.keys">{{ shortcut.macKeys }}</span>
            <span class="description">{{ shortcut.description }}</span>
          </div>
        }
      </div>

      <h3>Active Groups</h3>
      <div class="groups-list">
        @for (group of keyboardShortcuts.activeGroupIds(); track group) {
          <span class="group-badge">{{ group }}</span>
        }
      </div>

      <h3>Inactive Groups</h3>
      <div class="groups-list">
        @for (group of keyboardShortcuts.inactiveGroupIds(); track group) {
          <span class="group-badge inactive">{{ group }}</span>
        }
      </div>
    </div>
  `,
  styles: `
    .keyboard-shortcuts {
      padding: 1rem;
      font-family: system-ui, sans-serif;
    }

    .shortcuts-grid {
      display: grid;
      gap: 0.5rem;
      margin-bottom: 2rem;
    }

    .shortcut-item {
      display: grid;
      grid-template-columns: auto auto 1fr;
      gap: 1rem;
      align-items: center;
      padding: 0.5rem;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }

    .keys {
      font-family: monospace;
      background: #f5f5f5;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-weight: bold;
    }

    .mac-keys {
      font-family: monospace;
      background: #e8f4f8;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.9em;
    }

    .description {
      color: #666;
    }

    .groups-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 2rem;
    }

    .group-badge {
      background: #007acc;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.9em;
    }

    .group-badge.inactive {
      background: #ccc;
      color: #666;
    }

    h3 {
      margin: 1rem 0 0.5rem 0;
      color: #333;
    }
  `
})
export class NgxKeys {
  protected readonly keyboardShortcuts = inject(KeyboardShortcuts);
}
