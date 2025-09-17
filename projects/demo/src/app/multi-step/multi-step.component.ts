import { Component, ChangeDetectionStrategy, computed, inject, DestroyRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KeyboardShortcuts, KeyboardShortcut } from 'ngx-keys';

@Component({
    standalone: true,
    selector: 'demo-multi-step',
    imports: [CommonModule],
    templateUrl: './multi-step.component.html',
    styleUrls: ['./multi-step.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MultiStepComponent {
    private readonly keyboardService = inject(KeyboardShortcuts);
    private readonly destroyRef = inject(DestroyRef);
    private readonly shortcutId = 'demo-multi-step';

    // Signal to show a trigger message when the shortcut fires
    protected readonly triggerMessage = signal('');

    // Computed UI that derives from the library's shortcutsUI$ plus the trigger message
    protected readonly shortcutUi = computed(() => {
        const all = this.keyboardService.shortcutsUI$().all;
        const found = all.find((s: any) => s.id === this.shortcutId);
        if (!found) return { keys: '', macKeys: '', description: '' };
        const extra = this.triggerMessage() ? ' — ' + this.triggerMessage() : '';
        return { keys: found.keys, macKeys: found.macKeys, description: found.description + extra };
    });

    constructor() {
        const shortcut: KeyboardShortcut = {
            id: this.shortcutId,
            steps: [['ctrl', 'k'], ['s']],
            macSteps: [['meta', 'k'], ['s']],
            action: () => this.triggerMessage.set('Multi-step triggered at ' + new Date().toLocaleTimeString()),
            description: 'Demo multi-step: Ctrl+K then S'
        };

        try {
            this.keyboardService.register(shortcut);
        } catch {
            // ignore registration errors during dev
        }

        // Unregister when the component is destroyed
        this.destroyRef.onDestroy(() => {
            try { this.keyboardService.unregister(this.shortcutId); } catch { }
        });
    }
}
