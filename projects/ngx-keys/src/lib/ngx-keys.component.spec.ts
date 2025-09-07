import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NgxKeys } from './ngx-keys.component';
import { KeyboardShortcuts } from './keyboard-shortcuts';

describe('NgxKeys', () => {
  let component: NgxKeys;
  let fixture: ComponentFixture<NgxKeys>;
  let keyboardService: KeyboardShortcuts;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxKeys],
      providers: [
        provideZonelessChangeDetection(),
        KeyboardShortcuts
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NgxKeys);
    component = fixture.componentInstance;
    keyboardService = TestBed.inject(KeyboardShortcuts);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have access to keyboard service', () => {
    expect(component['keyboardShortcuts']).toBeDefined();
    expect(component['keyboardShortcuts']).toBe(keyboardService);
  });

  it('should display active shortcuts count via service', () => {
    // Register a test shortcut
    keyboardService.register({
      id: 'test',
      keys: ['ctrl', 's'],
      macKeys: ['meta', 's'],
      action: () => {},
      description: 'Test shortcut'
    });

    fixture.detectChanges();
    
    expect(keyboardService.activeShortcutsUI().length).toBe(1);
    expect(keyboardService.allShortcutsUI().length).toBe(1);
  });

  it('should update when shortcuts are activated/deactivated', () => {
    // Register and deactivate a shortcut
    keyboardService.register({
      id: 'test',
      keys: ['ctrl', 's'],
      macKeys: ['meta', 's'],
      action: () => {},
      description: 'Test shortcut'
    });
    
    keyboardService.deactivate('test');
    fixture.detectChanges();
    
    expect(keyboardService.activeShortcutsUI().length).toBe(0);
    expect(keyboardService.inactiveShortcutsUI().length).toBe(1);
    expect(keyboardService.allShortcutsUI().length).toBe(1);
  });

  it('should update when groups are registered', () => {
    const shortcuts = [
      {
        id: 'shortcut-1',
        keys: ['ctrl', 'c'],
        macKeys: ['meta', 'c'],
        action: () => {},
        description: 'Copy'
      }
    ];
    
    keyboardService.registerGroup('editing', shortcuts);
    fixture.detectChanges();
    
    expect(keyboardService.activeGroupIds().length).toBe(1);
    expect(keyboardService.activeGroupIds()).toContain('editing');
  });

  it('should render keyboard shortcuts in template', () => {
    keyboardService.register({
      id: 'save',
      keys: ['ctrl', 's'],
      macKeys: ['meta', 's'],
      action: () => {},
      description: 'Save document'
    });

    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Save document');
    expect(compiled.textContent).toContain('Ctrl+S');
  });

  it('should render Mac keys when different from PC keys', () => {
    keyboardService.register({
      id: 'save',
      keys: ['ctrl', 's'],
      macKeys: ['meta', 's'],
      action: () => {},
      description: 'Save document'
    });

    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('⌘+S');
  });

  it('should render active groups', () => {
    const shortcuts = [
      {
        id: 'copy',
        keys: ['ctrl', 'c'],
        macKeys: ['meta', 'c'],
        action: () => {},
        description: 'Copy'
      }
    ];
    
    keyboardService.registerGroup('editing', shortcuts);
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('editing');
  });

  it('should render inactive groups when deactivated', () => {
    const shortcuts = [
      {
        id: 'copy',
        keys: ['ctrl', 'c'],
        macKeys: ['meta', 'c'],
        action: () => {},
        description: 'Copy'
      }
    ];
    
    keyboardService.registerGroup('editing', shortcuts);
    keyboardService.deactivateGroup('editing');
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    const inactiveSection = compiled.querySelector('h3:nth-of-type(3)');
    expect(inactiveSection?.textContent).toContain('Inactive Groups');
  });

  it('should handle empty states correctly', () => {
    fixture.detectChanges();
    
    expect(keyboardService.activeShortcutsUI().length).toBe(0);
    expect(keyboardService.inactiveShortcutsUI().length).toBe(0);
    expect(keyboardService.allShortcutsUI().length).toBe(0);
    expect(keyboardService.activeGroupIds().length).toBe(0);
  });

  it('should display proper CSS classes', () => {
    keyboardService.register({
      id: 'save',
      keys: ['ctrl', 's'],
      macKeys: ['meta', 's'],
      action: () => {},
      description: 'Save document'
    });

    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.keyboard-shortcuts')).toBeTruthy();
    expect(compiled.querySelector('.shortcuts-grid')).toBeTruthy();
    expect(compiled.querySelector('.shortcut-item')).toBeTruthy();
    expect(compiled.querySelector('.keys')).toBeTruthy();
    expect(compiled.querySelector('.description')).toBeTruthy();
  });
});
