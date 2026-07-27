import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import {
  ProdutoRequest,
  ProdutoAtualizarRequest,
  ProdutoResponse,
  ProdutoFornecedorDto,
  UnidadeMedida,
  CategoriaProduto,
} from '../models/estoque.models';
import { SelectSearchComponent } from '../../../shared/components/select-search/select-search.component';
import { FieldErrorPipe } from '../../../shared/pipes/field-error.pipe';
import { permiteQuantidadeFracionada } from '../../../shared/unidade-medida';

import { ProdutoFornecedoresEditorComponent } from '../../../shared/components/produto-fornecedores-editor/produto-fornecedores-editor.component';
import { FornecedoresService } from '../fornecedor/fornecedor.service';

@Component({
  selector: 'app-novo-produto-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DialogModule, InputNumberModule, SelectSearchComponent, FieldErrorPipe, ProdutoFornecedoresEditorComponent],
  templateUrl: './novo-produto-modal.component.html',
})
export class NovoProdutoModalComponent implements OnInit, OnChanges {

  private fb = inject(FormBuilder);
  private fornecedoresService = inject(FornecedoresService);


  fornecedoresDisponiveis: string[] = [];

  @Input() visible  = false;
  @Input() produto: ProdutoResponse | null = null;
  @Input() salvando = false;

  @Output() fechar = new EventEmitter<void>();
  @Output() salvar = new EventEmitter<ProdutoRequest | ProdutoAtualizarRequest>();

  form = this.fb.group({
    nome:              ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    descricao:         [''],
    valorCompra:       [null as number | null, [Validators.required, Validators.min(0.01)]],
    preco:             [null as number | null, [Validators.min(0.01)]],
    precoDiaria:       [null as number | null, [Validators.min(0.01)]],
    quantidadeEstoque: [0, [Validators.required, Validators.min(0)]],
    estoqueMinimo:     [0, [Validators.min(0)]],
    medida:            [null as unknown as UnidadeMedida, [Validators.required]],
    categoria:         [null as unknown as CategoriaProduto, [Validators.required]],
    fornecedores:      [[] as ProdutoFornecedorDto[]],
  }, { validators: peloMenosUmPreco });

  get isEdicao(): boolean { return !!this.produto; }
  get titulo():   string  { return this.isEdicao ? 'Editar produto' : 'Novo produto'; }

  /** Libera casas decimais no estoque para unidades contínuas (metro, kg, litro…). */
  get permiteFracao(): boolean {
    return permiteQuantidadeFracionada(this.form.get('medida')?.value);
  }

  readonly unidades: { value: UnidadeMedida; label: string }[] = [
    { value: 'SACO',           label: 'Saco' },
    { value: 'METRO',          label: 'Metro (m)' },
    { value: 'METRO_QUADRADO', label: 'Metro quadrado (m²)' },
    { value: 'LITRO',          label: 'Litro' },
    { value: 'PECA',           label: 'Peça' },
    { value: 'KG',             label: 'Kg' },
    { value: 'ROLO',           label: 'Rolo' },
    { value: 'BALDE',          label: 'Balde' },
  ];

    readonly categorias: { value: CategoriaProduto; label: string }[] = [
    { value: 'FERRAMENTAS',      label: 'Ferramentas' },
    { value: 'ELETRICA',         label: 'Elétrica' },
    { value: 'CONEXOES_E_TUBOS', label: 'Conexões e Tubos' },
    { value: 'ENSACADOS',        label: 'Ensacados' },
    { value: 'MATERIAL_BRUTO',   label: 'Material Bruto' },
    { value: 'LOCACAO',          label: 'Locação' },
    { value: 'OUTROS',           label: 'Outros' },
  ];

  ngOnInit(): void {
    this.carregarFornecedores();
  }

  /** Recarrega a cada abertura: pega fornecedores criados nesta sessão e refaz uma busca que falhou. */
  private carregarFornecedores(): void {
    this.fornecedoresService.listar().subscribe({
      next: lista => this.fornecedoresDisponiveis = lista.map(f => f.nome),
      // Sem sugestões o campo continua utilizável (digitação livre) — não bloqueia o cadastro.
      error: () => this.fornecedoresDisponiveis = [],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.visible) return;
    // Recarrega só quando o modal acabou de abrir, não a cada mudança de input (ex.: salvando).
    if (changes['visible']?.currentValue === true) {
      this.carregarFornecedores();
    }
    if (this.produto) {
      this.form.reset({
        nome:              this.produto.nome,
        descricao:         this.produto.descricao ?? '',
        valorCompra:       Number(this.produto.valorCompra),
        preco:             Number(this.produto.preco),
        precoDiaria:       Number(this.produto.precoDiaria),
        quantidadeEstoque: this.produto.quantidadeEstoque,
        estoqueMinimo:     this.produto.estoqueMinimo,
        medida:            this.produto.medida,
        categoria:         this.produto.categoria,
        fornecedores:      this.produto.fornecedores ?? []
      });
    } else {
       this.form.reset({ nome: '', descricao: '', valorCompra: null, preco: null, precoDiaria: null, quantidadeEstoque: 0, estoqueMinimo: 0, medida: null as unknown as UnidadeMedida, categoria: null as unknown as CategoriaProduto, fornecedores: [] });
    }
  }

  onSalvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const payload = {
      nome:              v.nome!.trim(),
      descricao:         v.descricao?.trim() || undefined,
      valorCompra:       v.valorCompra!,
      preco:             v.preco!,
      precoDiaria:       v.precoDiaria!,
      quantidadeEstoque: v.quantidadeEstoque!,
      estoqueMinimo:     v.estoqueMinimo ?? 0,
      medida:            v.medida as UnidadeMedida,
      categoria:         v.categoria as CategoriaProduto,
      fornecedores:      v.fornecedores ?? [] 
    };
    this.salvar.emit(payload);
    this.fechar.emit();
  }
}

/** Exige pelo menos um dos preços (venda ou diária) preenchido e maior que zero. */
function peloMenosUmPreco(group: AbstractControl): ValidationErrors | null {
  const preco  = group.get('preco')?.value;
  const diaria = group.get('precoDiaria')?.value;
  const temPreco  = preco  != null && preco  > 0;
  const temDiaria = diaria != null && diaria > 0;
  return temPreco || temDiaria ? null : { peloMenosUmPreco: true };

}
