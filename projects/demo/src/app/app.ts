import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { KeyboardShortcuts, KeyboardShortcut } from 'ngx-keys';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('NgxKeys Demo');
  protected readonly lastAction = signal('Try pressing Ctrl+S, Ctrl+C, or Ctrl+H');
  protected readonly count = signal(0);

  constructor(private keyboardService: KeyboardShortcuts) {}

  ngOnInit() {
    // Register individual shortcuts
    this.keyboardService.register({
      id: 'save',
      keys: ['ctrl', 's'],
      macKeys: ['meta', 's'],
      action: () => this.handleSave(),
      description: 'Save document'
    });

    this.keyboardService.register({
      id: 'help',
      keys: ['ctrl', 'h'],
      macKeys: ['meta', 'h'],
      action: () => this.showHelp(),
      description: 'Show help'
    });

    // Register a group of editing shortcuts
    const editingShortcuts: KeyboardShortcut[] = [
      {
        id: 'copy',
        keys: ['ctrl', 'c'],
        macKeys: ['meta', 'c'],
        action: () => this.handleCopy(),
        description: 'Copy selection'
      },
      {
        id: 'paste',
        keys: ['ctrl', 'v'],
        macKeys: ['meta', 'v'],
        action: () => this.handlePaste(),
        description: 'Paste from clipboard'
      },
      {
        id: 'undo',
        keys: ['ctrl', 'z'],
        macKeys: ['meta', 'z'],
        action: () => this.handleUndo(),
        description: 'Undo last action'
      }
    ];

    this.keyboardService.registerGroup('editing', editingShortcuts);
  }

  ngOnDestroy() {
    // Clean up shortcuts
    this.keyboardService.unregister('save');
    this.keyboardService.unregister('help');
    this.keyboardService.unregisterGroup('editing');
  }

  private handleSave() {
    this.lastAction.set('📄 Document saved!');
    this.incrementCount();
  }

  private handleCopy() {
    this.lastAction.set('📋 Content copied!');
    this.incrementCount();
  }

  private handlePaste() {
    this.lastAction.set('📝 Content pasted!');
    this.incrementCount();
  }

  private handleUndo() {
    this.lastAction.set('↩️ Action undone!');
    this.incrementCount();
  }

  private showHelp() {
    this.lastAction.set('❓ Help requested!');
    this.incrementCount();
  }

  private incrementCount() {
    this.count.update(c => c + 1);
  }

  // Methods for button interactions
  protected toggleEditingGroup() {
    const isActive = this.keyboardService.isGroupActive('editing');
    if (isActive) {
      this.keyboardService.deactivateGroup('editing');
      this.lastAction.set('🚫 Editing shortcuts disabled');
    } else {
      this.keyboardService.activateGroup('editing');
      this.lastAction.set('✅ Editing shortcuts enabled');
    }
    this.incrementCount();
  }

  protected toggleSaveShortcut() {
    const isActive = this.keyboardService.isActive('save');
    if (isActive) {
      this.keyboardService.deactivate('save');
      this.lastAction.set('🚫 Save shortcut disabled');
    } else {
      this.keyboardService.activate('save');
      this.lastAction.set('✅ Save shortcut enabled');
    }
    this.incrementCount();
  }

  protected getEditingGroupStatus(): string {
    return this.keyboardService.isGroupActive('editing') ? '✅ Active' : '❌ Inactive';
  }

  protected getSaveShortcutStatus(): string {
    return this.keyboardService.isActive('save') ? '✅ Active' : '❌ Inactive';
  }
}
