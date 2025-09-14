import { Component, DestroyRef, inject, ChangeDetectionStrategy } from '@angular/core';
import { KeyboardShortcuts, KeyboardShortcut, KeyboardShortcutUI } from 'ngx-keys';
import { ActionService } from '../app';

@Component({
  selector: 'app-feature',
  imports: [],
  templateUrl: './feature.component.html',
  styleUrl: './feature.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeatureComponent {
  private readonly keyboardService = inject(KeyboardShortcuts);
  protected readonly actionService = inject(ActionService);
  private readonly destroyRef = inject(DestroyRef);

  // Reactive signals from the keyboard service
  protected readonly allActiveShortcuts = () => this.keyboardService.shortcutsUI$().active;
  // Filter for feature-specific shortcuts
  protected readonly activeFeatureShortcuts = () => {
    return this.keyboardService.shortcutsUI$().active.filter((shortcut: KeyboardShortcutUI) => 
      shortcut.id.startsWith('feature-')
    );
  };

  constructor() {
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

    // Setup cleanup on destroy
    this.destroyRef.onDestroy(() => {
      // Clean up feature-specific shortcuts when leaving this route
      this.keyboardService.unregisterGroup('feature-shortcuts');
    });
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
