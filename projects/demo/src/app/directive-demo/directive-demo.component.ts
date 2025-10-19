import { Component } from '@angular/core';
import { KeyboardShortcutDirective } from '../../../../ngx-keys/src/public-api';

@Component({
  selector: 'app-directive-demo',
  standalone: true,
  imports: [KeyboardShortcutDirective],
  templateUrl: './directive-demo.component.html',
  styleUrl: './directive-demo.component.css',
})
export class DirectiveDemoComponent {
  saveCount = 0;
  deleteCount = 0;
  helpVisible = false;
  lastAction = 'None';
  notifications: string[] = [];

  onSave(): void {
    this.saveCount++;
    this.addNotification('Saved document');
  }

  onDelete(): void {
    this.deleteCount++;
    this.addNotification('Deleted item');
  }

  toggleHelp = (): void => {
    this.helpVisible = !this.helpVisible;
    this.addNotification(`Help ${this.helpVisible ? 'shown' : 'hidden'}`);
  };

  onFormatDocument(): void {
    this.addNotification('Formatted document');
  }

  private addNotification(message: string): void {
    this.lastAction = message;
    this.notifications.unshift(message);
    if (this.notifications.length > 5) {
      this.notifications.pop();
    }
  }
}
