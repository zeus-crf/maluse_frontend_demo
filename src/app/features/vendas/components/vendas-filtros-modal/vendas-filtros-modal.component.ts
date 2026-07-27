import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { FormaPagamento, PedidoResponse, StatusPedido, VendasFiltroCompleto } from '../../models/vendas.models';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';

@Component({
  selector: 'app-vendas-filtros-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, DatePickerComponent],
  templateUrl: './vendas-filtros-modal.component.html',
})
export class VendasFiltrosModalComponent implements OnChanges {

  @Input() visible = false;
  @Input() pedidos: PedidoResponse[] = [];
  @Input() filtroAtual: VendasFiltroCompleto = {
    status: 'TODOS', formaPagamento: 'TODOS',
    inicio: '', fim: '', minValor: null, maxValor: null,
  };

  @Output() fechar  = new EventEmitter<void>();
  @Output() aplicar = new EventEmitter<VendasFiltroCompleto>();
  @Output() limpar  = new EventEmitter<void>();

  // ── Estado local ───────────────────────────────────────────
  status: StatusPedido | 'TODOS' = 'TODOS';
  formaPagamento: FormaPagamento | 'TODOS' = 'TODOS';
  inicio  = '';
  fim     = '';
  minValor: number | null = null;
  maxValor: number | null = null;

  readonly statusOpcoes: { valor: StatusPedido | 'TODOS'; label: string }[] = [
    { valor: 'TODOS',      label: 'Todos'      },
    { valor: 'CONFIRMADO', label: 'Confirmado' },
    { valor: 'PAGO',       label: 'Pago'       },
    { valor: 'PENDENTE',   label: 'Pendente'   },
    { valor: 'ORCAMENTO',  label: 'Orçamento'  },
    { valor: 'CANCELADO',  label: 'Cancelado'  },
  ];

  readonly pagamentoOpcoes: { valor: FormaPagamento | 'TODOS'; label: string }[] = [
    { valor: 'TODOS',          label: 'Todos'    },
    { valor: 'PIX',            label: 'PIX'      },
    { valor: 'DINHEIRO',       label: 'Dinheiro' },
    { valor: 'CARTAO_CREDITO', label: 'Crédito'  },
    { valor: 'CARTAO_DEBITO',  label: 'Débito'   },
    { valor: 'FIADO',          label: 'Fiado'    },
    { valor: 'BOLETO',         label: 'Boleto'   },
  ];

  // ── Sincroniza estado com filtros aplicados ao abrir ───────
  ngOnChanges(): void {
    if (this.visible) {
      this.status        = this.filtroAtual.status;
      this.formaPagamento = this.filtroAtual.formaPagamento;
      this.inicio        = this.filtroAtual.inicio;
      this.fim           = this.filtroAtual.fim;
      this.minValor      = this.filtroAtual.minValor;
      this.maxValor      = this.filtroAtual.maxValor;
    }
  }

  // ── Preview: quantos registros batem com os filtros locais ─
  get totalFiltrado(): number {
    return this.pedidos.filter(p => {
      const matchStatus = this.status === 'TODOS' || p.status === this.status;
      const matchPgto   = this.formaPagamento === 'TODOS' || p.formaPagamento === this.formaPagamento;
      const data        = p.createdAt ? p.createdAt.split('T')[0] : '';
      const matchInicio = !this.inicio || data >= this.inicio;
      const matchFim    = !this.fim    || data <= this.fim;
      const valor       = Number(p.valorTotal);
      const matchMin    = this.minValor === null || valor >= this.minValor;
      const matchMax    = this.maxValor === null || valor <= this.maxValor;
      return matchStatus && matchPgto && matchInicio && matchFim && matchMin && matchMax;
    }).length;
  }

  get temFiltroAtivo(): boolean {
      return this.status !== 'TODOS'         ||
            this.formaPagamento !== 'TODOS' ||
            this.minValor !== null          ||
            this.maxValor !== null;
  }

  onAplicar(): void {
    this.aplicar.emit({
      status: this.status,
      formaPagamento: this.formaPagamento,
      inicio:   this.inicio,
      fim:      this.fim,
      minValor: this.minValor,
      maxValor: this.maxValor,
    });
  }

  onLimpar(): void {
    this.status         = 'TODOS';
    this.formaPagamento = 'TODOS';
    this.inicio         = '';
    this.fim            = '';
    this.minValor       = null;
    this.maxValor       = null;
    this.limpar.emit();
  }
}
