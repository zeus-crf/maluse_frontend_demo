import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LocacoesComponent as Locacoes } from './locacoes.component';

describe('Locacoes', () => {
  let component: Locacoes;
  let fixture: ComponentFixture<Locacoes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Locacoes],
    }).compileComponents();

    fixture = TestBed.createComponent(Locacoes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
