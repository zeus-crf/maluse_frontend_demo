import { ChangeDetectorRef, Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { finalize } from 'rxjs';
import { LocacaoService } from '../locacoes/locacoes.service';
import { SelectOption } from '../../../shared/components/select/select.component';
import { SelectSearchComponent } from '../../../shared/components/select-search/select-search.component';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { ClienteSimples, EntregaRequest, FormaPagamento, LocacaoResponse, ProdutoSimples, StatusLocacao, TipoDesconto } from '../models/locacoes.models';
import { permiteQuantidadeFracionada } from '../../../shared/unidade-medida';

interface ItemForm {
  produtoNovo: boolean;
  produtoId: string;
  produtoNome: string;
  precoUnitario: number;
  quantidade: number;
  baixarEstoque: boolean;
}

@Component({
    selector: 'app-nova-locacao-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, DialogModule, ConfirmDialogModule, SelectSearchComponent, DatePickerComponent],
    providers: [ConfirmationService],
    templateUrl: './nova-locacao-modal.component.html',
})
export class NovaLocacaoModalComponent {

    private service             = inject(LocacaoService);
    private messageService      = inject(MessageService);
    private confirmationService = inject(ConfirmationService);
    private cdr                 = inject(ChangeDetectorRef);

    @Input() visible = false;
    @Input() produtos: ProdutoSimples[] = [];
    @Input() clientes: ClienteSimples[]  = [];
    @Input() loadingDados = false;

    @Output() fechar = new EventEmitter<void>();
    @Output() locacaoCriada = new EventEmitter<LocacaoResponse>();  // ✅ nome feminino (alinhado com o pai)

    // ✅ tipo tipado — 'LOCACAO' vs 'ORCAMENTO' (não mais string vazia)
    tipo: 'LOCACAO' | 'ORCAMENTO' = 'LOCACAO';
    consumidorFinal       = false;
    clienteId             = '';
    observacao            = '';
    dataRetirada          = '';
    dataDevolucaoPrevista = '';
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

    readonly tipoOpcoes: { val: 'LOCACAO' | 'ORCAMENTO'; label: string }[] = [
        { val: 'LOCACAO',    label: 'Locação'   },
        { val: 'ORCAMENTO',  label: 'Orçamento' },
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
        if (value && this.exigeCliente) return;
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
        return this.itens.reduce((acc, i) => acc + i.precoUnitario * i.quantidade * this.dias, 0);
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

    /** Número de dias entre retirada e devolução prevista */
    get dias(): number {
        if (!this.dataRetirada || !this.dataDevolucaoPrevista) return 0;
        const inicio = new Date(this.dataRetirada);
        const fim    = new Date(this.dataDevolucaoPrevista);
        return Math.max(0, (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
    }

    /** Total considera precoDiaria × quantidade × dias, menos desconto, mais juros */
    get total(): number {
        return Math.max(0, this.valorBruto - this.valorDesconto + this.valorJuros);
    }

    /** ✅ Inclui validação de datas obrigatórias e cliente para fiado/parcelado */
    get formValida(): boolean {
        const clienteOk = this.consumidorFinal ? !this.exigeCliente : !!this.clienteId;
        return (
            !!this.formaPagamento &&
            !!this.dataRetirada &&
            !!this.dataDevolucaoPrevista &&
            this.dataDevolucaoPrevista > this.dataRetirada &&
            this.itens.length > 0 &&
            this.itens.every(i => (i.produtoNovo ? !!i.produtoNome.trim() : !!i.produtoId) && i.quantidade > 0) &&
            clienteOk
        );
    }

    novoItem(): ItemForm {
        return { produtoNovo: false, produtoId: '', produtoNome: '', precoUnitario: 0, quantidade: 1, baixarEstoque: true };
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

    /** Itens que vão baixar estoque mas cuja quantidade excede o saldo disponível. */
    private itensSemSaldo(): ItemForm[] {
        return this.itens.filter(i => {
            if (!i.baixarEstoque || !i.produtoId) return false;
            const prod = this.produtos.find(p => p.id === i.produtoId);
            return !!prod && i.quantidade > prod.quantidadeEstoque;
        });
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
            item.produtoNome   = produto.nome;
            item.precoUnitario = Number(produto.precoDiaria);
        }
    }

    salvar(): void {
        if (!this.formValida) return;

        const semSaldo = this.itensSemSaldo();
        if (semSaldo.length > 0) {
            const nomes = semSaldo.map(i => i.produtoNome).join(', ');
            this.confirmationService.confirm({
                header: 'Locar sem estoque?',
                message: `Sem itens em estoque para: ${nomes}. O estoque ficará negativo. Deseja continuar?`,
                icon: 'pi pi-exclamation-triangle',
                acceptLabel: 'Sim, continuar',
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

        // ✅ status mapeado corretamente — ORCAMENTO ou ATIVA (padrão backend)
        const status: StatusLocacao = this.tipo === 'ORCAMENTO' ? 'ORCAMENTO' : 'ATIVA';

        this.service.postLocacao({
            clienteId:             this.clienteId || undefined,
            formaPagamento:        this.formaPagamento as FormaPagamento,
            dataRetirada:          this.dataRetirada,
            dataDevolucaoPrevista: this.dataDevolucaoPrevista,
            itens:                 this.itens.map(i => i.produtoNovo
                                     ? {
                                         produtoNome: i.produtoNome.trim(),
                                         quantidade: i.quantidade,
                                         precoDiaria: i.precoUnitario,
                                         baixarEstoque: false,
                                         permitirSemEstoque: false,
                                       }
                                     : {
                                         produtoId: i.produtoId,
                                         quantidade: i.quantidade,
                                         precoDiaria: i.precoUnitario,
                                         baixarEstoque: i.baixarEstoque,
                                         permitirSemEstoque: permitirSemEstoque && i.baixarEstoque,
                                       }),
            observacao:            this.observacao || null,
            status,
            desconto:              this.desconto || null,
            tipoDesconto:          this.desconto ? this.tipoDesconto : null,
            numeroParcelas:        this.numeroParcelas > 1 ? this.numeroParcelas : undefined,
            primeiroVencimento:    this.usaParcelas && this.primeiroVencimento ? this.primeiroVencimento : undefined,
            entrega:               this.temEntrega && this.enderecoEntrega
                                     ? { endereco: this.enderecoEntrega, dataPrevista: this.dataPrevistaEntrega || null }
                                     : null,
            dataMovimento:         this.dataMovimento || undefined,
            juros:                 this.juros || null,
            tipoJuros:             this.juros ? this.tipoJuros : null,
        }, this.tipo === 'ORCAMENTO').pipe(
            finalize(() => { this.salvando = false; this.cdr.detectChanges(); })
        ).subscribe({
            next: (locacao) => {
                this.locacaoCriada.emit(locacao);
                this.resetForm();
            },
            error: (err: any) => {
                const detail = err?.error?.message ?? 'Não foi possível criar a locação';
                this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
            },
        });
    }

    fecharModal(): void {
        this.resetForm();
        this.fechar.emit();
    }

    private resetForm(): void {
        this.salvando              = false;
        this.tipo                  = 'LOCACAO';
        this.consumidorFinal       = false;
        this.dataRetirada          = '';
        this.dataDevolucaoPrevista = '';
        this.clienteId             = '';
        this.formaPagamento        = '';
        this.itens                 = [this.novoItem()];
        this.observacao            = '';
        this.desconto              = null;
        this.tipoDesconto          = 'PERCENTUAL';
        this.numeroParcelas        = 1;
        this.primeiroVencimento    = '';
        this.temEntrega            = false;
        this.enderecoEntrega       = '';
        this.dataPrevistaEntrega   = '';
        this.dataMovimento         = new Date().toISOString().split('T')[0];
        this.juros                 = null;
        this.tipoJuros             = 'PERCENTUAL';
    }

    rowTotal(item: ItemForm): number {
        return item.precoUnitario * item.quantidade * this.dias;
    }

    formatCurrency(v: number): string {
        return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    trackByIndex(index: number): number { return index; }
}
