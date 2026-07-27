import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { PedidoResponse, FormaPagamento, TipoDesconto } from '../../models/vendas.models';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';

@Component({
  selector: 'app-pedido-edicao-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, DatePickerComponent],
  templateUrl: './edicao-modal.component.html',
})
export class PedidoEdicaoModalComponent {

  @Input() visible = false;
  @Input() salvando = false;

  @Input() set pedido(p: PedidoResponse | null) {
    this._pedido = p;
    this.formaPagamento = p?.formaPagamento ?? '';
    this.observacao     = p?.observacao    ?? '';
    this.dataMovimento  = p?.dataMovimento ?? new Date().toISOString().split('T')[0];
    this.desconto       = p?.desconto      ?? null;
    this.tipoDesconto   = p?.tipoDesconto  ?? 'PERCENTUAL';
    this.juros          = p?.juros         ?? null;
    this.tipoJuros      = p?.tipoJuros     ?? 'PERCENTUAL';
  }
  get pedido(): PedidoResponse | null { return this._pedido; }
  private _pedido: PedidoResponse | null = null;

  @Output() fechar = new EventEmitter<void>();
  @Output() salvar = new EventEmitter<{ observacao: string; formaPagamento: FormaPagamento; dataMovimento: string; desconto: number | null; tipoDesconto: TipoDesconto; juros: number | null; tipoJuros: TipoDesconto }>();

  formaPagamento: FormaPagamento | '' = '';
  observacao = '';
  dataMovimento: string = new Date().toISOString().split('T')[0];
  desconto: number | null = null;
  tipoDesconto: TipoDesconto = 'PERCENTUAL';
  juros: number | null = null;
  tipoJuros: TipoDesconto = 'PERCENTUAL';

  readonly tipoDescontoOpcoes: { val: TipoDesconto; label: string }[] = [
    { val: 'PERCENTUAL', label: '%'  },
    { val: 'VALOR',      label: 'R$' },
  ];

  readonly tipoJurosOpcoes: { val: TipoDesconto; label: string }[] = [
    { val: 'PERCENTUAL', label: '%'  },
    { val: 'VALOR',      label: 'R$' },
  ];

  readonly formasPagamento: { valor: FormaPagamento; label: string }[] = [
    { valor: 'PIX',            label: 'PIX'      },
    { valor: 'DINHEIRO',       label: 'Dinheiro' },
    { valor: 'CARTAO_CREDITO', label: 'Crédito'  },
    { valor: 'CARTAO_DEBITO',  label: 'Débito'   },
    { valor: 'FIADO',          label: 'Fiado'    },
    { valor: 'BOLETO',         label: 'Boleto'   },
  ];

  formatCurrency(v: number): string {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatData(iso: string): string {
    if (!iso) return '';
    const [year, month, day] = iso.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  }

  // Base do desconto = valorTotal atual (desconto é cumulativo)
  get valorBruto(): number { return this._pedido?.valorTotal ?? 0; }

  get valorDesconto(): number {
    if (!this.desconto || this.desconto <= 0) return 0;
    return this.tipoDesconto === 'PERCENTUAL'
      ? this.valorBruto * this.desconto / 100
      : this.desconto;
  }

  get valorJuros(): number {
    if (!this.juros || this.juros <= 0) return 0;
    const base = this.valorBruto - this.valorDesconto;
    return this.tipoJuros === 'PERCENTUAL'
      ? base * this.juros / 100
      : this.juros;
  }

  get totalComDesconto(): number { return Math.max(0, this.valorBruto - this.valorDesconto + this.valorJuros); }

  onSalvar(): void {
    if (!this.formaPagamento) return;
    this.salvar.emit({
      observacao:     this.observacao,
      formaPagamento: this.formaPagamento,
      dataMovimento:  this.dataMovimento,
      desconto:       this.desconto,
      tipoDesconto:   this.tipoDesconto,
      juros:          this.juros,
      tipoJuros:      this.tipoJuros,
    });
  }

  fecharModal(): void {
    this.fechar.emit();
  }
}
