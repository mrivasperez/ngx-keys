import { Component, inject } from '@angular/core';
import { KeyboardShortcuts, KeyboardShortcutUI } from 'ngx-keys';
import { ActionService } from '../app';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
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
