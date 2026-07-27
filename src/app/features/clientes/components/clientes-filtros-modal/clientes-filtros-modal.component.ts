import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import {
  ClienteResponse,
  ClienteFiltroCompleto,
  TabFiltroCliente,
  FILTRO_CLIENTE_PADRAO,
} from '../../models/clientes.models';

@Component({
  selector: 'app-clientes-filtros-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule],
  templateUrl: './clientes-filtros-modal.component.html',
})
export class ClientesFiltrosModalComponent implements OnChanges {

  @Input() visible = false;
  @Input() clientes: ClienteResponse[] = [];
  @Input() filtroAtual: ClienteFiltroCompleto = { ...FILTRO_CLIENTE_PADRAO };

  @Output() fechar  = new EventEmitter<void>();
  @Output() aplicar = new EventEmitter<ClienteFiltroCompleto>();
  @Output() limpar  = new EventEmitter<void>();

  // ── Estado local ──────────────────────────────────────────
  tipoCliente: TabFiltroCliente = 'TODOS';
  dataInicial: string  = '';
  dataFinal:   string  = '';
  minCompras:  number | null = null;
  maxCompras:  number | null = null;

  ngOnChanges(): void {
    if (this.visible) {
      this.tipoCliente = this.filtroAtual.tipoCliente;
      this.dataInicial = this.filtroAtual.dataInicial ?? '';
      this.dataFinal   = this.filtroAtual.dataFinal   ?? '';
      this.minCompras  = this.filtroAtual.minCompras;
      this.maxCompras  = this.filtroAtual.maxCompras;
    }
  }

  // ── Preview de resultados ─────────────────────────────────
  get totalFiltrado(): number {
    return this.clientes.filter(c => {
      const tipo = c.consumidorFinal ? 'PF' : 'PJ';
      const matchTipo = this.tipoCliente === 'TODOS' || tipo === this.tipoCliente;
      const gasto = Number(c.totalGasto);
      const matchMin = this.minCompras === null || gasto >= this.minCompras;
      const matchMax = this.maxCompras === null || gasto <= this.maxCompras;
      return matchTipo && matchMin && matchMax;
    }).length;
  }

  onAplicar(): void {
    this.aplicar.emit({
      tipoCliente: this.tipoCliente,
      dataInicial: this.dataInicial || null,
      dataFinal:   this.dataFinal   || null,
      minCompras:  this.minCompras,
      maxCompras:  this.maxCompras,
    });
  }

  get temFiltroAtivo(): boolean {
    return this.tipoCliente !== 'TODOS'
      || !!this.dataInicial
      || !!this.dataFinal
      || this.minCompras !== null
      || this.maxCompras !== null;
  }

  onLimpar(): void {
    this.tipoCliente = 'TODOS';
    this.dataInicial = '';
    this.dataFinal   = '';
    this.minCompras  = null;
    this.maxCompras  = null;
    this.limpar.emit();
  }
}
