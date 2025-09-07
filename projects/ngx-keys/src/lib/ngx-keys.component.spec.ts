import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NgxKeys } from './ngx-keys.component';
import { KeyboardShortcuts } from './keyboard-shortcuts';

describe('NgxKeys', () => {
  let component: NgxKeys;
  let fixture: ComponentFixture<NgxKeys>;

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
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
