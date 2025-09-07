import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxKeys } from './ngx-keys.component';

describe('NgxKeys', () => {
  let component: NgxKeys;
  let fixture: ComponentFixture<NgxKeys>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxKeys]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NgxKeys);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
