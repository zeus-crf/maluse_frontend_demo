import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import {
  ClienteResponse,
  ClienteHistoricoResponse,
  ClienteSaldoResponse,
  AbatimentoResumo,
  ItemDevido,
  ObservacaoResponse,
} from '../../models/clientes.models';
import { ClientesService } from '../../clientes/clientes.service';
import { MessageService, ConfirmationService } from 'primeng/api';

type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';
type Tab = 'vendas' | 'locacoes' | 'divida' | 'observacoes';

@Component({
  selector: 'app-cliente-historico-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, TagModule, ConfirmDialogModule],
  providers: [ConfirmationService],
  templateUrl: './cliente-historico-modal.component.html',
})
export class ClienteHistoricoModalComponent implements OnChanges {

  private clientesService = inject(ClientesService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  // App roda zoneless (sem zone.js): mudanças de campo dentro de callbacks assíncronos
  // não disparam render sozinhas — cada callback precisa fechar com detectChanges().
  private cdr = inject(ChangeDetectorRef);

  @Input() visible = false;
  @Input() cliente: ClienteResponse | null = null;

  @Output() fechar = new EventEmitter<void>();

  historico: ClienteHistoricoResponse | null = null;
  loading = false;
  tabAtiva: Tab = 'vendas';

  saldo: ClienteSaldoResponse | null = null;
  abatimentos: AbatimentoResumo[] = [];
  valorDebito: number | null = null;
  debitando = false;

  observacoes: ObservacaoResponse[] = [];
  novaObservacao = '';
  salvandoObservacao = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cliente'] && this.cliente) {
      this.tabAtiva = 'vendas';
      this.carregarHistorico(this.cliente.id);
      this.carregarSaldo(this.cliente.id);
      this.carregarObservacoes(this.cliente.id);
    }
    if (changes['cliente'] && !this.cliente) {
      this.historico = null;
      this.limparEstadoDivida();
      this.observacoes = [];
      this.novaObservacao = '';
    }
  }

  private carregarHistorico(id: string): void {
    this.loading = true;
    this.historico = null;
    this.clientesService.getHistorico(id).subscribe({
      next: h => { this.historico = h; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); },
    });
  }

  private carregarSaldo(id: string): void {
    this.clientesService.getSaldo(id).subscribe({
      next: s => { this.saldo = s; this.cdr.detectChanges(); },
      error: err => {
        const detail = err?.error?.message ?? 'Não foi possível carregar o saldo.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
      },
    });
    this.clientesService.getAbatimentos(id).subscribe({
      next: a => { this.abatimentos = a; this.cdr.detectChanges(); },
      error: err => {
        const detail = err?.error?.message ?? 'Não foi possível carregar os abatimentos.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
      },
    });
  }

  private limparEstadoDivida(): void {
    this.saldo = null;
    this.abatimentos = [];
    this.valorDebito = null;
  }

  debitar(): void {
    if (!this.cliente || !this.valorDebito || this.valorDebito <= 0) { return; }

    this.debitando = true;

    this.clientesService.debitar(this.cliente.id, { valor: this.valorDebito }).subscribe({
      next: r => {
        this.debitando = false;
        this.valorDebito = null;
        this.cdr.detectChanges();
        this.carregarSaldo(this.cliente!.id);
        // O backend devolve os saldos antes/depois — confirma o resultado ao operador
        this.messageService.add({
          severity: 'success',
          summary: 'Débito registrado',
          detail: `${this.formatCurrency(r.valorAbatido)} abatido. Saldo: ${this.formatCurrency(r.saldoAtual)}`,
        });
      },
      error: err => {
        this.debitando = false;
        this.cdr.detectChanges();
        const detail = err?.error?.message ?? 'Não foi possível registrar o débito.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
      },
    });
  }

  estornar(abatimentoId: string): void {
    if (!this.cliente) { return; }

    this.clientesService.estornarAbatimento(abatimentoId).subscribe({
      next: () => {
        this.cdr.detectChanges();
        this.carregarSaldo(this.cliente!.id);
        this.messageService.add({
          severity: 'success',
          summary: 'Estornado',
          detail: 'O abatimento foi desfeito e a dívida voltou ao valor anterior.',
        });
      },
      error: err => {
        const detail = err?.error?.message ?? 'Não foi possível estornar.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
      },
    });
  }

  // ── Observações ───────────────────────────────────────────

  private carregarObservacoes(id: string): void {
    this.clientesService.getObservacoes(id).subscribe({
      next: o => { this.observacoes = o; this.cdr.detectChanges(); },
      error: err => {
        const detail = err?.error?.message ?? 'Não foi possível carregar as observações.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
      },
    });
  }

  adicionarObservacao(): void {
    const texto = this.novaObservacao.trim();
    if (!this.cliente || !texto) { return; }

    this.salvandoObservacao = true;

    this.clientesService.criarObservacao(this.cliente.id, { texto }).subscribe({
      next: () => {
        this.salvandoObservacao = false;
        this.novaObservacao = '';
        this.cdr.detectChanges();
        this.carregarObservacoes(this.cliente!.id);
        this.messageService.add({ severity: 'success', summary: 'Observação registrada', detail: '' });
      },
      error: err => {
        this.salvandoObservacao = false;
        this.cdr.detectChanges();
        const detail = err?.error?.message ?? 'Não foi possível salvar a observação.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
      },
    });
  }

  confirmarRemocaoObservacao(observacao: ObservacaoResponse): void {
    // Apagar é irreversível — não há estorno como no abatimento.
    this.confirmationService.confirm({
      header: 'Apagar observação?',
      message: 'Esta ação não pode ser desfeita.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim, apagar',
      rejectLabel: 'Cancelar',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.removerObservacao(observacao.id),
    });
  }

  private removerObservacao(observacaoId: string): void {
    if (!this.cliente) { return; }

    this.clientesService.deletarObservacao(observacaoId).subscribe({
      next: () => {
        this.carregarObservacoes(this.cliente!.id);
        this.messageService.add({ severity: 'success', summary: 'Observação removida', detail: '' });
      },
      error: err => {
        const detail = err?.error?.message ?? 'Não foi possível remover a observação.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
      },
    });
  }

  /** Data e hora da observação — o backend manda ISO completo (createdAt). */
  formatDateTime(iso: string): string {
    if (!iso) { return '—'; }
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  /** Receita avulsa não tem número de pedido/locação — rotula pela origem. */
  origemLabel(item: ItemDevido): string {
    if (item.origemTipo === 'PEDIDO')  { return `Pedido #${item.numero}`; }
    if (item.origemTipo === 'LOCACAO') { return `Locação #${item.numero}`; }
    return 'Lançamento avulso';
  }

  statusPedidoLabel(status: string): string {
    const map: Record<string, string> = {
      CONFIRMADO: 'Confirmado', PAGO: 'Pago', ORCAMENTO: 'Orçamento', CANCELADO: 'Cancelado',
    };
    return map[status] ?? status;
  }

  statusPedidoSeverity(status: string): Severity {
    const map: Record<string, Severity> = {
      CONFIRMADO: 'info', PAGO: 'success', ORCAMENTO: 'secondary', CANCELADO: 'danger',
    };
    return map[status] ?? 'secondary';
  }

  statusLocacaoLabel(status: string): string {
    const map: Record<string, string> = {
      ATIVA: 'Ativa', ATRASADA: 'Atrasada', DEVOLVIDA: 'Devolvida', CANCELADA: 'Cancelada',
    };
    return map[status] ?? status;
  }

  statusLocacaoSeverity(status: string): Severity {
    const map: Record<string, Severity> = {
      ATIVA: 'info', ATRASADA: 'warn', DEVOLVIDA: 'success', CANCELADA: 'danger',
    };
    return map[status] ?? 'secondary';
  }

  formatCurrency(v: number): string {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
  }

  onFechar(): void {
    this.fechar.emit();
  }
}
