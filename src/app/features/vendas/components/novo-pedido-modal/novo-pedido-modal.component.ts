import { ChangeDetectorRef, Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { finalize } from 'rxjs';
import { VendasService } from '../../vendas.service';
import {
  PedidoResponse, ProdutoSimples, ClienteSimples, FormaPagamento, StatusPedido, TipoDesconto, EntregaRequest
} from '../../models/vendas.models';
import { SelectOption } from '../../../../shared/components/select/select.component';
import { SelectSearchComponent } from '../../../../shared/components/select-search/select-search.component';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { permiteQuantidadeFracionada } from '../../../../shared/unidade-medida';

interface ItemForm {
  produtoNovo: boolean;
  produtoId: string;
  produtoNome: string;
  precoUnitario: number;
  quantidade: number;
  baixarEstoque: boolean;
}

@Component({
  selector: 'app-novo-pedido-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ConfirmDialogModule, SelectSearchComponent, DatePickerComponent],
  providers: [ConfirmationService],
  templateUrl: './novo-pedido-modal.component.html',
})
export class NovoPedidoModalComponent {
  private service             = inject(VendasService);
  private messageService      = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private cdr                 = inject(ChangeDetectorRef);

  @Input() visible = false;
  @Input() produtos: ProdutoSimples[] = [];
  @Input() clientes: ClienteSimples[] = [];
  @Input() loadingDados = false;

  @Output() fechar = new EventEmitter<void>();
  @Output() pedidoCriado = new EventEmitter<PedidoResponse>();

  // Form state
  tipo: 'PEDIDO' | 'ORCAMENTO' = 'PEDIDO';
  consumidorFinal = false;
  dataVencimento = '';
  clienteId = '';
  observacao = '';
  formaPagamento: FormaPagamento | '' = '';
  desconto: number | null = null;
  tipoDesconto: TipoDesconto = 'PERCENTUAL';
  numeroParcelas = 1;
  primeiroVencimento = '';

  itens: ItemForm[] = [this.novoItem()];
  salvando = false;

  // Entrega
  temEntrega = false;
  enderecoEntrega = '';
  dataPrevistaEntrega = '';

  // Data do movimento
  dataMovimento: string = new Date().toISOString().split('T')[0];

  // Juros
  juros: number | null = null;
  tipoJuros: TipoDesconto = 'PERCENTUAL';

  readonly tipoOpcoes: { val: 'PEDIDO' | 'ORCAMENTO'; label: string }[] = [
    { val: 'PEDIDO',    label: 'Venda'     },
    { val: 'ORCAMENTO', label: 'Orçamento' },
  ];

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

  get isFiado(): boolean { return this.formaPagamento === 'FIADO'; }
  get isOrcamento(): boolean { return this.tipo === 'ORCAMENTO'; }
  get usaParcelas(): boolean { return this.isFiado || this.numeroParcelas > 1; }
  /** Fiado e parcelado exigem cliente — sem devedor identificado não faz sentido */
  get exigeCliente(): boolean { return this.isFiado || this.numeroParcelas > 1; }

  setConsumidorFinal(value: boolean): void {
    if (value && this.exigeCliente) return; // bloqueado quando fiado/parcelado
    this.consumidorFinal = value;
    if (value) this.clienteId = '';
  }

  onSelectFormaPagamento(valor: FormaPagamento): void {
    this.formaPagamento = valor;
    if (this.exigeCliente) this.consumidorFinal = false;
  }

  onNumeroParcelas(value: number): void {
    this.numeroParcelas = Number(value);
    if (this.exigeCliente) this.consumidorFinal = false;
  }

  get valorBruto(): number {
    return this.itens.reduce((acc, i) => acc + i.precoUnitario * i.quantidade, 0);
  }

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

  get clienteOptions(): SelectOption[] {
    return this.clientes.map(c => ({ value: c.id, label: c.nome }));
  }

  get produtoOptions(): SelectOption[] {
    return this.produtos.map(p => ({ value: p.id, label: p.nome }));
  }

  get total(): number {
    return Math.max(0, this.valorBruto - this.valorDesconto + this.valorJuros);
  }

  get formValida(): boolean {
    const clienteOk = this.consumidorFinal ? !this.exigeCliente : !!this.clienteId;
    return (
      !!this.formaPagamento &&
      this.itens.length > 0 &&
      this.itens.every(i => (i.produtoNovo ? !!i.produtoNome.trim() : !!i.produtoId) &&
      i.quantidade > 0 ) &&
      clienteOk
    );
  }

  novoItem(): ItemForm {
    return { produtoNovo: false ,produtoId: '', produtoNome: '', precoUnitario: 0, quantidade: 1, baixarEstoque: true };
  }

  /** Itens que vão baixar estoque mas cuja quantidade excede o saldo disponível. */
  private itensSemSaldo(): ItemForm[] {
    return this.itens.filter(i => {
      if (!i.baixarEstoque || !i.produtoId) return false;
      const prod = this.produtos.find(p => p.id === i.produtoId);
      return !!prod && i.quantidade > prod.quantidadeEstoque;
    });
  }

   alternarProdutoNovo(item: ItemForm): void {
    item.produtoNovo = !item.produtoNovo;
    if (item.produtoNovo) {
      // produto novo não conhece estoque: não baixa
      item.produtoId = '';
      item.baixarEstoque = false;
    } else {
      item.produtoNome = '';
      item.precoUnitario = 0;
      item.baixarEstoque = true;
    }
  }

  adicionarLinha(): void {
    this.itens = [...this.itens, this.novoItem()];
  }

  removerLinha(index: number): void {
    this.itens = this.itens.filter((_, i) => i !== index);
  }

  /** Produtos com unidade contínua (metro, kg, litro…) aceitam quantidade fracionada. */
  permiteFracao(item: ItemForm): boolean {
    const produto = this.produtos.find(p => p.id === item.produtoId);
    return permiteQuantidadeFracionada(produto?.medida);
  }

  incrementarQty(item: ItemForm): void {
    item.quantidade++;
  }

  decrementarQty(index: number): void {
    const item = this.itens[index];
    if (item.quantidade > 1) {
      item.quantidade--;
    } else {
      this.removerLinha(index);
    }
  }

  onProdutoChange(item: ItemForm): void {
    const produto = this.produtos.find(p => p.id === item.produtoId);
    if (produto) {
      item.produtoNome = produto.nome;
      item.precoUnitario = Number(produto.preco);
    }
  }

  salvar(): void {
    if (!this.formValida) return;

    const semSaldo = this.itensSemSaldo();
    if (semSaldo.length > 0) {
      const nomes = semSaldo.map(i => i.produtoNome).join(', ');
      this.confirmationService.confirm({
        header: 'Vender sem estoque?',
        message: `Sem itens em estoque para: ${nomes}. O estoque ficará negativo. Deseja continuar?`,
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sim, vender',
        rejectLabel: 'Cancelar',
        acceptButtonProps: { severity: 'danger' },
        rejectButtonProps: { severity: 'secondary', outlined: true },
        accept: () => this.enviar(true),
      });
      return;
    }
    this.enviar(false);
  }

  private enviar(permitirSemEstoque: boolean): void {
    this.salvando = true;
    const status: StatusPedido = this.tipo === 'ORCAMENTO' ? 'ORCAMENTO' : 'CONFIRMADO';
    this.service.postPedidos({
      clienteId:         this.clienteId || undefined,
      formaPagamento:    this.formaPagamento as FormaPagamento,
      itens:             this.itens.map(i => i.produtoNovo 
                        ? { 
                            produtoNome: i.produtoNome.trim(),
                            quantidade: i.quantidade,
                            preco: i.precoUnitario,
                            baixarEstoque: false,
                            permitirSemEstoque: false,
                          
                          }
                        : {
                            productId: i.produtoId,
                            quantidade: i.quantidade,
                            preco: i.precoUnitario,
                            baixarEstoque: i.baixarEstoque,
                            permitirSemEstoque: permitirSemEstoque && i.baixarEstoque,
                        }),
                           
      status,
      dataVencimento:    this.isFiado && this.numeroParcelas === 1 && this.primeiroVencimento ? this.primeiroVencimento : undefined,
      observacao:        this.observacao || undefined,
      desconto:          this.desconto || null,
      tipoDesconto:      this.desconto ? this.tipoDesconto : null,
      numeroParcelas:    this.numeroParcelas > 1 ? this.numeroParcelas : undefined,
      primeiroVencimento: this.usaParcelas && this.primeiroVencimento ? this.primeiroVencimento : undefined,
      entrega:           this.temEntrega && this.enderecoEntrega
                           ? { endereco: this.enderecoEntrega, dataPrevista: this.dataPrevistaEntrega || null }
                           : null,
      dataMovimento:     this.dataMovimento || undefined,
      juros:             this.juros || null,
      tipoJuros:         this.juros ? this.tipoJuros : null,
    }).pipe(
      finalize(() => { this.salvando = false; this.cdr.detectChanges(); })
    ).subscribe({
      next: (pedido) => {
        this.pedidoCriado.emit(pedido);
        this.resetForm();
      },
      error: (err) => {
        const detail = err?.error?.message ?? 'Não foi possível criar o pedido';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
      },
    });
  }

  fecharModal(): void {
    this.resetForm();
    this.fechar.emit();
  }

  private resetForm(): void {
    this.salvando           = false;
    this.tipo               = 'PEDIDO';
    this.consumidorFinal    = false;
    this.dataVencimento     = '';
    this.clienteId          = '';
    this.formaPagamento     = '';
    this.itens              = [this.novoItem()];
    this.observacao         = '';
    this.desconto           = null;
    this.tipoDesconto       = 'PERCENTUAL';
    this.numeroParcelas     = 1;
    this.primeiroVencimento = '';
    this.temEntrega         = false;
    this.enderecoEntrega    = '';
    this.dataPrevistaEntrega = '';
    this.dataMovimento      = new Date().toISOString().split('T')[0];
    this.juros              = null;
    this.tipoJuros          = 'PERCENTUAL';
  }

  rowTotal(item: ItemForm): number { return item.precoUnitario * item.quantidade; }

  formatCurrency(v: number): string {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  trackByIndex(index: number): number { return index; }
}