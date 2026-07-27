import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { PedidoResponse, StatusPedido, ParcelaResponse, EntregaResponse } from '../../models/vendas.models';
import { VendasService } from '../../vendas.service';
import { EntregaService } from '../../entrega.service';
import { WhatsaapCobrancaModalComponent } from "../../../../shared/components/whatsapp/whatsapp-cobranca-modal.component";
import { ExportService } from '../../../../shared/services/export.service';

@Component({
    selector: 'app-pedido-detalhe-modal',
    standalone: true,
    imports: [CommonModule, DialogModule, TagModule, WhatsaapCobrancaModalComponent],
    templateUrl: './pedido-detalhe-modal.component.html',
})
export class PedidoDetalheModalComponent implements OnChanges {

    private vendasService  = inject(VendasService);
    private entregaService = inject(EntregaService);
    private cdr            = inject(ChangeDetectorRef);
    private messageService = inject(MessageService);
    exportService = inject(ExportService);

    @Input() visible = false;
    @Input() pedido: PedidoResponse | null = null;
    @Input() salvando = false;
    showWaModal = false;
    showWaTooltip = false;
    tooltipX = 0;
    tooltipY = 0;

    onWaEnter(event: MouseEvent): void {
      if (window.innerWidth >= 640) return;
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      this.tooltipX = rect.left + rect.width / 2 + 20;
      this.tooltipY = rect.top - 8;
      this.showWaTooltip = true;
    }

    onWaLeave(): void { this.showWaTooltip = false; }

    @Output() fechar          = new EventEmitter<void>();
    @Output() pagar           = new EventEmitter<string>();
    @Output() cancelar        = new EventEmitter<string>();
    @Output() confirmar       = new EventEmitter<string>();
    @Output() parcelaPaga     = new EventEmitter<ParcelaResponse | null>();
    @Output() entregaMarcada  = new EventEmitter<EntregaResponse>();

    parcelas: ParcelaResponse[] = [];
    loadingParcelas = false;
    pagandoParcela: string | null = null;
    marcandoEntrega = false;

    ngOnChanges(changes: SimpleChanges): void {
        const visibleOn  = changes['visible']?.currentValue === true;
        const pedidoMuda = !!changes['pedido']?.currentValue;
        if ((visibleOn || pedidoMuda) && this.visible && this.pedido) {
            this.carregarDetalhe();
        }
        if (changes['visible']?.currentValue === false) {
            this.parcelas        = [];
            this.pagandoParcela  = null;
            this.marcandoEntrega = false;
        }
    }

    private carregarDetalhe(): void {
    if (!this.pedido) return;
    this.loadingParcelas = true;
    this.vendasService.getByPedidoId(this.pedido.id).subscribe({
        next: pedido => {
            this.parcelas       = pedido.parcelas ?? [];
            this.loadingParcelas = false;
            this.cdr.detectChanges();
        },
        error: (err: any) => {
            this.loadingParcelas = false;
            const detail = err?.error?.message ?? 'Não foi possível carregar as parcelas';
            this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
        }
    });
}

    pagarParcela(parcelaId: string): void {
        if (!this.pedido) return;
        this.pagandoParcela = parcelaId;
        this.vendasService.patchPagarParcela(parcelaId).subscribe({
            next: () => {
                const hoje = new Date();
                const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
                this.parcelas = this.parcelas.map(p =>
                    p.id === parcelaId
                        ? { ...p, status: 'PAGO' as const, dataPagamento: dataHoje }
                        : p
                );
                this.pagandoParcela = null;
                this.cdr.detectChanges();
                // Notifica o pai para atualizar o badge na tabela
                const allPago = this.parcelas.every(p => p.status === 'PAGO');
                const proxima = allPago
                    // Todas pagas → emite a última para mostrar "N/N pagas" na tabela
                    ? ([...this.parcelas].sort((a, b) => b.numeroParcela - a.numeroParcela)[0] ?? null)
                    : (this.parcelas.find(p => p.status === 'PENDENTE') ?? null);
                this.parcelaPaga.emit(proxima);
                // Se todas pagas, marca o pedido inteiro como PAGO
                if (allPago && this.podePagar) {
                    this.pagar.emit(this.pedido!.id);
                }
            },
            error: (err: any) => {
                this.pagandoParcela = null;
                const detail = err?.error?.message ?? 'Não foi possível registrar o pagamento';
                this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
                this.cdr.detectChanges();
            }
        });
    }

    marcarEntregue(): void {
        if (!this.pedido?.entrega) return;
        this.marcandoEntrega = true;
        this.entregaService.patchEntregar(this.pedido.entrega.id).subscribe({
            next: (entrega) => {
                if (this.pedido) {
                    this.pedido = { ...this.pedido, entrega };
                }
                this.marcandoEntrega = false;
                this.entregaMarcada.emit(entrega);
                this.cdr.detectChanges();
                this.messageService.add({ severity: 'success', summary: 'Entregue', detail: 'Entrega registrada com sucesso!', life: 3000 });
            },
            error: (err: any) => {
                this.marcandoEntrega = false;
                const detail = err?.error?.message ?? 'Não foi possível registrar a entrega';
                this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
                this.cdr.detectChanges();
            }
        });
    }

    get podeCobrarWhatsapp(): boolean {
  return this.pedido?.status === 'CONFIRMADO' || this.pedido?.status === 'PENDENTE';
    }

    get mensagemWhatsapp(): string {
    const p = this.pedido;
    if (!p) return '';
    const nome = p.clienteNome;
    const total = this.formatCurrency(p.valorTotal);
    const parcela = p.parcelaMesAtual;

    if (p.status === 'CONFIRMADO') {
        if (parcela && parcela.status === 'PENDENTE') {
        return `Olá ${nome}! 😊 Passando para lembrar que a parcela ${parcela.numeroParcela}/${parcela.totalParcelas} no valor de ${this.formatCurrency(parcela.valor)} vence em ${this.formatData(parcela.dataVencimento!)}. Quando consegue resolver? Qualquer dúvida é só falar!`;
        }
        return `Olá ${nome}! 😊 Passando para lembrar que você tem uma compra confirmada no valor de ${total}. Quando consegue resolver o pagamento? Qualquer dúvida é só falar!`;
    }

    // PENDENTE (vencido)
    if (parcela && parcela.status === 'PENDENTE') {
        return `Olá ${nome}! A parcela ${parcela.numeroParcela}/${parcela.totalParcelas} no valor de ${this.formatCurrency(parcela.valor)} venceu em ${this.formatData(parcela.dataVencimento!)}. Podemos combinar o pagamento? Fico no aguardo!`;
    }
    return `Olá ${nome}! Temos uma pendência em aberto no valor de ${total} com vencimento em ${this.formatData(p.dataVencimento!)}. Podemos combinar o pagamento? Fico no aguardo!`;
    }

    get podeConfirmar(): boolean {
        return !!this.pedido && this.pedido.status === 'ORCAMENTO';
    }

    get podePagar(): boolean {
        return !!this.pedido &&
               this.pedido.status !== 'PAGO' &&
               this.pedido.status !== 'CANCELADO' &&
               this.pedido.status !== 'ORCAMENTO';
    }

    get podeCancelar(): boolean {
        return !!this.pedido && this.pedido.status !== 'CANCELADO';
    }

    get parcelasPagasCount(): number {
        return this.parcelas.filter(p => p.status === 'PAGO').length;
    }

    isVencida(parcela: ParcelaResponse): boolean {
        if (!parcela.dataVencimento || parcela.status !== 'PENDENTE') return false;
        return new Date(parcela.dataVencimento + 'T12:00:00') < new Date();
    }

    getStatusParcelaLabel(parcela: ParcelaResponse): string {
        if (parcela.status === 'PAGO')      return 'Pago';
        if (parcela.status === 'CANCELADO') return 'Cancelado';
        return this.isVencida(parcela) ? 'Vencida' : 'Pendente';
    }

    getSeverity(status: StatusPedido): 'success' | 'warn' | 'danger' | 'secondary' {
        switch (status) {
            case 'PAGO':       return 'success';
            case 'CONFIRMADO': return 'warn';
            case 'PENDENTE':   return 'danger';
            case 'CANCELADO':  return 'danger';
            case 'ORCAMENTO':  return 'secondary';
        }
    }

    getStatusLabel(status: StatusPedido): string {
        const labels: Record<StatusPedido, string> = {
            ORCAMENTO:  'Orçamento',
            CONFIRMADO: 'Confirmado',
            PENDENTE:   'Vencido',
            PAGO:       'Pago',
            CANCELADO:  'Cancelado',
        };
        return labels[status];
    }

    getPagamentoLabel(forma: string): string {
        const labels: Record<string, string> = {
            DINHEIRO:       'Dinheiro',
            PIX:            'PIX',
            CARTAO_DEBITO:  'Cartão Débito',
            CARTAO_CREDITO: 'Cartão Crédito',
            BOLETO:         'Boleto',
            FIADO:          'Fiado',
        };
        return labels[forma] ?? forma;
    }

    formatCurrency(v: number): string {
        return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    formatData(iso: string): string {
        if (!iso) return '';
        const [year, month, day] = iso.split('T')[0].split('-');
        return `${day}/${month}/${year}`;
    }

    formatNumero(n: number): string {
        return String(n ?? 0).padStart(3, '0');
    }
}
