import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { ProdutoResponse } from '../models/estoque.models';

/** Modal somente-leitura de um produto, incluindo seus fornecedores e preços. */
@Component({
  selector: 'app-produto-detalhe-modal',
  standalone: true,
  imports: [CommonModule, DialogModule, TagModule],
  templateUrl: './produto-detalhe-modal.component.html',
})
export class ProdutoDetalheModalComponent {

  @Input() visible = false;
  @Input() produto: ProdutoResponse | null = null;

  @Output() fechar = new EventEmitter<void>();
  @Output() editar = new EventEmitter<ProdutoResponse>();

  get statusLabel(): string {
    if (!this.produto) return '';
    if (this.produto.quantidadeEstoque <= 0) return 'Zerado';
    return this.produto.estoqueBaixo ? 'Estoque baixo' : 'OK';
  }

  get statusSeverity(): 'success' | 'warn' | 'danger' {
    if (!this.produto) return 'success';
    if (this.produto.quantidadeEstoque <= 0) return 'danger';
    return this.produto.estoqueBaixo ? 'warn' : 'success';
  }

  formatCurrency(v: number | null): string {
    if (v == null) return '—';
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  onEditar(): void {
    if (this.produto) this.editar.emit(this.produto);
  }

  onFechar(): void {
    this.fechar.emit();
  }
}
