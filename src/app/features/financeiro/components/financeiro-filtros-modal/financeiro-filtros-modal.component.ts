import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import {
  LancamentoFinanceiroResponse,
  FinanceiroFiltro,
  FILTRO_FINANCEIRO_PADRAO,
  StatusLancamento,
  TabFiltroFinanceiro,
} from '../../models/financeiro.models';

@Component({
  selector: 'app-financeiro-filtros-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, DatePickerComponent],
  templateUrl: './financeiro-filtros-modal.component.html',
})
export class FinanceiroFiltrosModalComponent implements OnChanges {

  @Input() visible     = false;
  @Input() lancamentos: LancamentoFinanceiroResponse[] = [];
  @Input() filtroAtual: FinanceiroFiltro = { ...FILTRO_FINANCEIRO_PADRAO };

  @Output() fechar  = new EventEmitter<void>();
  @Output() aplicar = new EventEmitter<FinanceiroFiltro>();
  @Output() limpar  = new EventEmitter<void>();

  // ── Estado local ──────────────────────────────────────────
  status:      StatusLancamento | 'TODOS' = 'TODOS';
  dataInicial  = '';
  dataFinal    = '';
  minValor:    number | null = null;
  maxValor:    number | null = null;

  ngOnChanges(): void {
    if (this.visible) {
      this.status      = this.filtroAtual.status;
      this.dataInicial = this.filtroAtual.dataInicial ?? '';
      this.dataFinal   = this.filtroAtual.dataFinal   ?? '';
      this.minValor    = null;
      this.maxValor    = null;
    }
  }

    get temFiltroAtivo(): boolean {
    return this.status   !== 'TODOS' ||
           this.dataInicial !== ''    ||
           this.dataFinal !== ''    ||
           this.minValor   !== null    ||
           this.maxValor   !== null;
  }


  get totalFiltrado(): number {
    const hoje = new Date().toISOString().split('T')[0];
    return this.lancamentos.filter(l => {
      const statusEfetivo: StatusLancamento =
        l.status === 'PAGO' || l.status === 'CANCELADO' ? l.status :
        (l.dataVencimento && l.dataVencimento < hoje) ? 'VENCIDO' : 'PENDENTE';

      const matchStatus = this.status === 'TODOS' || statusEfetivo === this.status;
      const data = l.dataVencimento ?? '';
      const matchInicio = !this.dataInicial || data >= this.dataInicial;
      const matchFim    = !this.dataFinal   || data <= this.dataFinal;
      const v = Number(l.valor);
      const matchMin = this.minValor === null || v >= this.minValor;
      const matchMax = this.maxValor === null || v <= this.maxValor;

      return matchStatus && matchInicio && matchFim && matchMin && matchMax;
    }).length;
  }

  onAplicar(): void {
    this.aplicar.emit({
      ...this.filtroAtual,
      status:      this.status,
      dataInicial: this.dataInicial || null,
      dataFinal:   this.dataFinal   || null,
    });
  }

  onLimpar(): void {
    this.status      = 'TODOS';
    this.dataInicial = '';
    this.dataFinal   = '';
    this.minValor    = null;
    this.maxValor    = null;
    this.limpar.emit();
  }

  onFechar(): void {
    this.fechar.emit();
  }
}
