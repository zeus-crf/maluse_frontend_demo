import { Component, Input, ElementRef, AfterViewChecked, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { ProdutoFornecedorDto } from '../../../features/estoque/models/estoque.models';

/**
 * Lista editável de fornecedores de um produto. Cada linha é um fornecedor
 * (select com busca no painel, permitindo digitar um nome novo) + um preço de
 * compra opcional. CVA cujo valor é ProdutoFornecedorDto[] — trabalha com nomes.
 */
@Component({
  selector: 'app-produto-fornecedores-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, InputNumberModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ProdutoFornecedoresEditorComponent),
      multi: true,
    },
  ],
  styles: [`
    :host ::ng-deep .p-select,
    :host ::ng-deep .p-inputnumber { width: 100%; }
    :host ::ng-deep .p-inputnumber input { width: 100%; min-width: 0; }
  `],
  template: `
    <div class="flex flex-col gap-3">
      @for (linha of linhas; track $index) {
        <div class="flex flex-col gap-2 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5 min-w-0">
              <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Fornecedor</div>
              <p-select
                [(ngModel)]="linha.nome"
                (ngModelChange)="emitir()"
                [options]="opcoesPara($index)"
                [editable]="true"
                [filter]="true"
                [disabled]="disabled"
                placeholder="Buscar ou cadastrar…"
                emptyFilterMessage="Digite para cadastrar um novo"
                appendTo="body"
                styleClass="w-full" />
            </div>
            <div class="flex flex-col gap-1.5 min-w-0">
              <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]">Preço de compra</div>
              <p-inputnumber
                [(ngModel)]="linha.precoCompra"
                (ngModelChange)="emitir()"
                [disabled]="disabled"
                mode="currency" currency="BRL" locale="pt-BR" [minFractionDigits]="2"
                placeholder="Opcional"
                class="w-full" />
            </div>
          </div>
          <button type="button" (click)="remover($index)" [disabled]="disabled"
            class="self-end flex items-center gap-1 text-[12px] font-medium text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
            <i class="pi pi-trash text-[11px]"></i>
            Remover
          </button>
        </div>
      }
      <button type="button" (click)="adicionar()" [disabled]="disabled"
        class="self-start text-[13px] font-medium text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50">
        + adicionar fornecedor
      </button>
    </div>
  `,
})
export class ProdutoFornecedoresEditorComponent implements ControlValueAccessor, AfterViewChecked {
  /** Nomes já cadastrados, usados como opções do select. */
  @Input() options: string[] = [];

  linhas: ProdutoFornecedorDto[] = [];
  disabled = false;

  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  private onChange = (_: ProdutoFornecedorDto[]) => {};
  onTouched = () => {};

  /**
   * O p-select em modo `editable` não renderiza placeholder no input do gatilho.
   * Setamos manualmente (o painel/filtro vai para o body via appendTo, então só o
   * input do gatilho fica dentro do host).
   */
  ngAfterViewChecked(): void {
    this.host.nativeElement
      .querySelectorAll<HTMLInputElement>('.p-select input')
      .forEach(input => {
        if (!input.placeholder) input.placeholder = 'Buscar ou cadastrar…';
      });
  }

  /** Opções da linha `i`: exclui fornecedores já escolhidos em outras linhas. */
  opcoesPara(i: number): string[] {
    const escolhidosEmOutras = new Set(
      this.linhas
        .filter((_, idx) => idx !== i)
        .map(l => (l.nome ?? '').trim().toLowerCase())
        .filter(Boolean),
    );
    return this.options.filter(o => !escolhidosEmOutras.has(o.toLowerCase()));
  }

  adicionar(): void {
    this.linhas = [...this.linhas, { nome: '', precoCompra: null }];
  }

  remover(i: number): void {
    this.linhas = this.linhas.filter((_, idx) => idx !== i);
    this.emitir();
  }

  /** Propaga só as linhas com fornecedor preenchido, com o nome trimado. */
  emitir(): void {
    const saida = this.linhas
      .map(l => ({ nome: (l.nome ?? '').trim(), precoCompra: l.precoCompra ?? null }))
      .filter(l => l.nome !== '');
    this.onChange(saida);
  }

  writeValue(valores: ProdutoFornecedorDto[] | null): void {
    this.linhas = (valores ?? []).map(v => ({ nome: v.nome, precoCompra: v.precoCompra ?? null }));
  }

  registerOnChange(fn: (_: ProdutoFornecedorDto[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }
}
