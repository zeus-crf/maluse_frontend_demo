import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProdutoFornecedoresEditorComponent } from './produto-fornecedores-editor.component';

describe('ProdutoFornecedoresEditorComponent', () => {
  let component: ProdutoFornecedoresEditorComponent;
  let fixture: ComponentFixture<ProdutoFornecedoresEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProdutoFornecedoresEditorComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ProdutoFornecedoresEditorComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('deve iniciar sem linhas', () => {
    expect(component.linhas).toEqual([]);
  });

  it('deve tratar null do writeValue como lista vazia', () => {
    component.writeValue(null as never);
    expect(component.linhas).toEqual([]);
  });

  it('adicionar cria uma linha vazia', () => {
    component.adicionar();
    expect(component.linhas).toEqual([{ nome: '', precoCompra: null }]);
  });

  it('remover exclui a linha pelo índice', () => {
    component.writeValue([{ nome: 'Tigre', precoCompra: 8 }, { nome: 'Amanco', precoCompra: null }]);
    component.remover(0);
    expect(component.linhas).toEqual([{ nome: 'Amanco', precoCompra: null }]);
  });

  it('opcoesPara exclui fornecedores escolhidos em outras linhas, ignorando caixa', () => {
    component.options = ['Votorantim', 'Tigre', 'Amanco'];
    component.writeValue([{ nome: 'votorantim', precoCompra: null }, { nome: '', precoCompra: null }]);

    // linha 1 (vazia) não deve sugerir "Votorantim", já escolhido na linha 0
    expect(component.opcoesPara(1)).toEqual(['Tigre', 'Amanco']);
    // linha 0 ainda vê todas (não exclui a si mesma)
    expect(component.opcoesPara(0)).toEqual(['Votorantim', 'Tigre', 'Amanco']);
  });

  it('emite apenas linhas com fornecedor preenchido, com nome trimado', () => {
    const emitidos: unknown[] = [];
    component.registerOnChange(v => emitidos.push(v));
    component.linhas = [{ nome: '  Tigre  ', precoCompra: 8 }, { nome: '', precoCompra: 5 }];
    component.emitir();
    expect(emitidos.at(-1)).toEqual([{ nome: 'Tigre', precoCompra: 8 }]);
  });

  it('adicionar acrescenta ao final sem apagar as existentes', () => {
    component.writeValue([{ nome: 'Tigre', precoCompra: 8 }]);
    component.adicionar();
    expect(component.linhas).toEqual([
      { nome: 'Tigre', precoCompra: 8 },
      { nome: '', precoCompra: null },
    ]);
  });
});
