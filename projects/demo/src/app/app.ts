import { Component, OnInit, OnDestroy, Injectable, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { KeyboardShortcuts, KeyboardShortcut } from 'ngx-keys';

@Injectable({
  providedIn: 'root'
})
export class ActionService {
  private readonly _lastAction = signal('Try pressing global shortcuts: Ctrl+S, Ctrl+C, or Ctrl+H');
  private readonly _count = signal(0);

  readonly lastAction = this._lastAction.asReadonly();
  readonly count = this._count.asReadonly();

  setAction(action: string) {
    this._lastAction.set(action);
    this._count.update(c => c + 1);
  }

  incrementCount() {
    this._count.update(c => c + 1);
  }
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = 'NgxKeys Demo';

  constructor(
    private keyboardService: KeyboardShortcuts,
    private actionService: ActionService
  ) {}

  ngOnInit() {
    // Register global shortcuts that are active on all routes
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

    // Register a group of global editing shortcuts
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
    // Clean up global shortcuts
    this.keyboardService.unregister('save');
    this.keyboardService.unregister('help');
    this.keyboardService.unregisterGroup('editing');
  }

  private handleSave() {
    this.actionService.setAction('📄 Global: Document saved!');
  }

  private handleCopy() {
    this.actionService.setAction('📋 Global: Content copied!');
  }

  private handlePaste() {
    this.actionService.setAction('📝 Global: Content pasted!');
  }

  private handleUndo() {
    this.actionService.setAction('↩️ Global: Action undone!');
  }

  private showHelp() {
    this.actionService.setAction('❓ Global: Help requested!');
  }
}
