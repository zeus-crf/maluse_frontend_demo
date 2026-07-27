import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { LancamentoFinanceiroResponse, StatusLancamento } from '../../models/financeiro.models';

@Component({
  selector: 'app-lancamento-detalhe-modal',
  standalone: true,
  imports: [CommonModule, DialogModule, TagModule],
  templateUrl: './lancamento-detalhe-modal.component.html',
})
export class LancamentoDetalheModalComponent {

  @Input() visible  = false;
  @Input() salvando = false;
  @Input() lancamento: LancamentoFinanceiroResponse | null = null;

  @Output() fechar = new EventEmitter<void>();
  @Output() pagar  = new EventEmitter<string>();
  @Output() editar = new EventEmitter<LancamentoFinanceiroResponse>();

  get podePagar(): boolean {
    const s = this.statusEfetivo;
    return s === 'PENDENTE' || s === 'VENCIDO';
  }

  get statusEfetivo(): StatusLancamento {
    const l = this.lancamento;
    if (!l) return 'PENDENTE';
    if (l.status === 'PAGO' || l.status === 'CANCELADO') return l.status;
    const hoje = new Date().toISOString().split('T')[0];
    if (l.dataVencimento && l.dataVencimento < hoje) return 'VENCIDO';
    return 'PENDENTE';
  }

  get statusSeverity(): 'success' | 'warn' | 'danger' | 'secondary' {
    switch (this.statusEfetivo) {
      case 'PAGO':      return 'success';
      case 'PENDENTE':  return 'warn';
      case 'VENCIDO':   return 'danger';
      case 'CANCELADO': return 'secondary';
    }
  }

  get statusLabel(): string {
    const labels: Record<StatusLancamento, string> = {
      PAGO: 'Pago', PENDENTE: 'Pendente', VENCIDO: 'Vencido', CANCELADO: 'Cancelado',
    };
    return labels[this.statusEfetivo];
  }

  formatCurrency(v: number): string {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatDate(d: string | null): string {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
  }

  onPagar(): void {
    if (this.lancamento) this.pagar.emit(this.lancamento.id);
  }

  onEditar(): void {
    if (this.lancamento) this.editar.emit(this.lancamento);
  }

  onFechar(): void {
    this.fechar.emit();
  }
}
