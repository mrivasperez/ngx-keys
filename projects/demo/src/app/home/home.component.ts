import { Component, inject } from '@angular/core';
import { KeyboardShortcuts, KeyboardShortcutUI } from 'ngx-keys';
import { ActionService } from '../app';

@Component({
  selector: 'app-home',
  imports: [],
  template: `
    <h2>Home Page</h2>
    <p>This page demonstrates global keyboard shortcuts that work on all routes.</p>
    
    <p><strong>Last Action:</strong> {{ actionService.lastAction() }}</p>
    <small>Total Actions: {{ actionService.count() }}</small>

    <section class="controls">
      <button (click)="toggleSaveShortcut()">
        Toggle Save ({{ getSaveShortcutStatus() }})
      </button>
      <button (click)="toggleEditingGroup()">
        Toggle Editing Group ({{ getEditingGroupStatus() }})
      </button>
    </section>

    <section class="shortcuts-display">
      <fieldset>
        <legend>🟢 Active Shortcuts ({{ activeShortcuts().length }})</legend>
        @if (activeShortcuts().length > 0) {
          <ol>
            @for (shortcut of activeShortcuts(); track shortcut.id) {
              <li>
                <kbd>{{ shortcut.keys }}</kbd> - {{ shortcut.description }}
              </li>
            }
          </ol>
        } @else {
          <p><em>No active shortcuts</em></p>
        }
      </fieldset>

      <fieldset>
        <legend>🔴 Inactive Shortcuts ({{ inactiveShortcuts().length }})</legend>
        @if (inactiveShortcuts().length > 0) {
          <ol>
            @for (shortcut of inactiveShortcuts(); track shortcut.id) {
              <li>
                <kbd>{{ shortcut.keys }}</kbd> - {{ shortcut.description }}
              </li>
            }
          </ol>
        } @else {
          <p><em>All shortcuts are active!</em></p>
        }
      </fieldset>

      <fieldset>
        <legend>📁 Active Groups ({{ activeGroups().length }})</legend>
        @if (activeGroups().length > 0) {
          <ol>
            @for (groupId of activeGroups(); track groupId) {
              <li>{{ groupId }}</li>
            }
          </ol>
        } @else {
          <p><em>No active groups</em></p>
        }
      </fieldset>
    </section>

    <section>
      <fieldset>
        <legend>📋 All Registered Shortcuts ({{ allShortcuts().length }})</legend>
        <div class="shortcuts-grid">
          @for (shortcut of allShortcuts(); track shortcut.id) {
            <article>
              <h3>
                <kbd>{{ shortcut.keys }}</kbd>
                @if (shortcut.macKeys !== shortcut.keys) {
                  <br><small>Mac: <kbd>{{ shortcut.macKeys }}</kbd></small>
                }
              </h3>
              <p>{{ shortcut.description }}</p>
            </article>
          }
        </div>
      </fieldset>
    </section>
  `,
  styles: ``
})
export class HomeComponent {
  private readonly keyboardService = inject(KeyboardShortcuts);
  protected readonly actionService = inject(ActionService);

  // Reactive signals from the keyboard service
  protected readonly activeShortcuts = () => this.keyboardService.shortcutsUI$().active;
  protected readonly inactiveShortcuts = () => this.keyboardService.shortcutsUI$().inactive;
  protected readonly allShortcuts = () => this.keyboardService.shortcutsUI$().all;
  protected readonly activeGroups = () => this.keyboardService.shortcuts$().groups.active;

  constructor() {
    // Component is ready - no need to register shortcuts as they're global now
  }

  // Methods for button interactions to control global shortcuts
  protected toggleEditingGroup() {
    const isActive = this.keyboardService.isGroupActive('editing');
    if (isActive) {
      this.keyboardService.deactivateGroup('editing');
      this.actionService.setAction('🚫 Global editing shortcuts disabled');
    } else {
      this.keyboardService.activateGroup('editing');
      this.actionService.setAction('✅ Global editing shortcuts enabled');
    }
  }

  protected toggleSaveShortcut() {
    const isActive = this.keyboardService.isActive('save');
    if (isActive) {
      this.keyboardService.deactivate('save');
      this.actionService.setAction('🚫 Global save shortcut disabled');
    } else {
      this.keyboardService.activate('save');
      this.actionService.setAction('✅ Global save shortcut enabled');
    }
  }

  protected getEditingGroupStatus(): string {
    return this.keyboardService.isGroupActive('editing') ? '✅ Active' : '❌ Inactive';
  }

  protected getSaveShortcutStatus(): string {
    return this.keyboardService.isActive('save') ? '✅ Active' : '❌ Inactive';
  }
}
