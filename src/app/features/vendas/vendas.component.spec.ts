import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VendasComponent as Vendas } from './vendas.component';

describe('Vendas', () => {
  let component: Vendas;
  let fixture: ComponentFixture<Vendas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Vendas],
    }).compileComponents();

    fixture = TestBed.createComponent(Vendas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
