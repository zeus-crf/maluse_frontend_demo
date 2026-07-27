import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EstoqueComponent as Estoque } from './estoque.component';

describe('Estoque', () => {
  let component: Estoque;
  let fixture: ComponentFixture<Estoque>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Estoque],
    }).compileComponents();

    fixture = TestBed.createComponent(Estoque);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
