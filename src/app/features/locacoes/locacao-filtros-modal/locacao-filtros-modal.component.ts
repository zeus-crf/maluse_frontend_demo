import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { FormaPagamento, LocacoesFiltroCompleto, StatusLocacao } from '../models/locacoes.models';

@Component({
  selector: 'app-locacao-filtros-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule],
  templateUrl: './locacao-filtros-modal.component.html',
})
export class LocacaoFiltrosModalComponent implements OnChanges {

  @Input() visible = false;
  @Input() filtroAtual!: LocacoesFiltroCompleto;

  @Output() fechar  = new EventEmitter<void>();
  @Output() aplicar = new EventEmitter<LocacoesFiltroCompleto>();
  @Output() limpar  = new EventEmitter<void>();

  // Estado local do formulário
  status: StatusLocacao | 'TODOS'      = 'TODOS';
  formaPagamento: FormaPagamento | 'TODOS' = 'TODOS';
  minValor: number | null = null;
  maxValor: number | null = null;

  readonly statusOpcoes: { label: string; value: StatusLocacao | 'TODOS' }[] = [
    { label: 'Todas',      value: 'TODOS'     },
    { label: 'Ativa',      value: 'ATIVA'     },
    { label: 'Atrasada',   value: 'ATRASADA'  },
    { label: 'Devolvida',  value: 'DEVOLVIDA' },
    { label: 'Cancelada',  value: 'CANCELADA' },
    { label: 'Orçamento',  value: 'ORCAMENTO' },
  ];

  readonly pagamentoOpcoes: { label: string; value: FormaPagamento | 'TODOS' }[] = [
    { label: 'Todas',   value: 'TODOS'         },
    { label: 'PIX',     value: 'PIX'           },
    { label: 'Dinheiro',value: 'DINHEIRO'      },
    { label: 'Crédito', value: 'CARTAO_CREDITO'},
    { label: 'Débito',  value: 'CARTAO_DEBITO' },
    { label: 'Boleto',  value: 'BOLETO'        },
    { label: 'Fiado',   value: 'FIADO'         },
  ];

  ngOnChanges(): void {
    if (this.visible && this.filtroAtual) {
      this.status        = this.filtroAtual.status;
      this.formaPagamento = this.filtroAtual.formaPagamento;
      this.minValor      = this.filtroAtual.minValor;
      this.maxValor      = this.filtroAtual.maxValor;
    }
  }

  get temFiltroAtivo(): boolean {
    return this.status !== 'TODOS' ||
           this.formaPagamento !== 'TODOS' ||
           this.minValor !== null ||
           this.maxValor !== null;
  }

  get contadorFiltros(): number {
    let n = 0;
    if (this.status !== 'TODOS')         n++;
    if (this.formaPagamento !== 'TODOS') n++;
    if (this.minValor !== null)          n++;
    if (this.maxValor !== null)          n++;
    return n;
  }

  onAplicar(): void {
    this.aplicar.emit({
      ...this.filtroAtual,
      status:         this.status,
      formaPagamento: this.formaPagamento,
      minValor:       this.minValor,
      maxValor:       this.maxValor,
    });
  }

  onLimpar(): void {
    this.status         = 'TODOS';
    this.formaPagamento = 'TODOS';
    this.minValor       = null;
    this.maxValor       = null;
    this.limpar.emit();
  }
}
