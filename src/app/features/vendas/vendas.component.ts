import { Component, OnInit, inject, ChangeDetectorRef, signal } from '@angular/core';

type Periodo = 'mes' | 'trimestre' | 'semestre' | 'ano' | 'custom';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule } from 'ng-apexcharts';
import { MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';
import { VendasService } from './vendas.service';
import {
  PedidoResponse,
  ProdutoSimples,
  ClienteSimples,
  StatusPedido,
  FormaPagamento,
  PedidoAtualizarRequest,
  VendasFiltroCompleto,
  ParcelaResponse,
  EntregaResponse
} from './models/vendas.models';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { TableColumn, TableActionConfig } from '../../shared/components/data-table/data-table.models';
import { SelectComponent } from '../../shared/components/select/select.component';
import { NovoPedidoModalComponent } from './components/novo-pedido-modal/novo-pedido-modal.component';
import { PedidoDetalheModalComponent } from './components/pedido-detalhe-modal/pedido-detalhe-modal.component';
import { PedidoEdicaoModalComponent } from './components/pedido-edicao-modal/edicao-modal.component';
import { VendasFiltrosModalComponent } from './components/vendas-filtros-modal/vendas-filtros-modal.component';
import { DatePickerComponent } from '../../shared/components/date-picker/date-picker.component';
import { ExportService, ExportFormato } from '../../shared/services/export.service';



@Component({
  selector: 'app-vendas',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule, DataTableComponent, NovoPedidoModalComponent, PedidoDetalheModalComponent, PedidoEdicaoModalComponent, VendasFiltrosModalComponent, SelectComponent, DatePickerComponent],
  templateUrl: './vendas.component.html',
  styleUrl: './vendas.component.scss',
})
export class VendasComponent implements OnInit {
  private service = inject(VendasService);
  private cdr = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  exportService = inject(ExportService)

  readonly opcoesOrdenacao = [
    { value: 'recente', label: 'Mais recentes' },
    { value: 'antigo',  label: 'Mais antigos'  },
  ];

  // ── Dados ──────────────────────────────────────────────────
  pedidos: PedidoResponse[] = [];
  produtos: ProdutoSimples[] = [];
  clientes: ClienteSimples[] = [];
  vendasMes = 0;

  // ── Loading ────────────────────────────────────────────────
  loading = true;
  salvando = false;
  loadingModal = false;

  // ── Período ────────────────────────────────────────────────
  periodoAtivo: Periodo = 'mes';
  customInicio = '';
  customFim    = '';

  readonly periodos: { label: string; value: Periodo }[] = [
    { label: 'Este mês',  value: 'mes'       },
    { label: 'Trimestre', value: 'trimestre' },
    { label: 'Semestre',  value: 'semestre'  },
    { label: 'Este ano',  value: 'ano'       },
    { label: 'Período',   value: 'custom'    },
  ];

  // ── Filtros ────────────────────────────────────────────────
  ordenacao: 'recente' | 'antigo' = 'recente';
  filtro: VendasFiltroCompleto = {
    status: 'TODOS', formaPagamento: 'TODOS',
    inicio: '', fim: '', minValor: null, maxValor: null,
  };

  // ── Modais ─────────────────────────────────────────────────
  showModalCriar = false;
  showModalDetalhe = false;
  showModalEdicao = false;
  showModalFiltros = false;
  pedidoSelecionado: PedidoResponse | null = null;

  // ── Donut "Por Status" ─────────────────────────────────────
  donutChart: any = { type: 'donut', height: 200, fontFamily: 'inherit' };
  donutColors = ['#22c55e', '#f59e0b', '#ef4444', '#94a3b8'];
  donutLabels = ['Pago', 'Confirmado', 'Cancelado', 'Cancelado'];
  donutLegend: any = { show: false };
  donutDataLabels: any = { enabled: false };
  donutPlotOptions: any = { pie: { donut: { size: '72%' } } };
  donutStroke: any = { width: 0 };
  donutTooltip: any = { y: { formatter: (v: number) => this.formatCurrency(v) } };

  // ── Barras horizontais "Top Clientes" ──────────────────────
  barHChart: any = { type: 'bar', height: 220, toolbar: { show: false }, fontFamily: 'inherit' };
  barHPlotOptions: any = { bar: { horizontal: true, barHeight: '60%', borderRadius: 3 } };
  barHColors = ['#3b82f6'];
  barHDataLabels: any = { enabled: false };
  barHGrid: any = {
    borderColor: '#f1f5f9',
    strokeDashArray: 4,
    xaxis: { lines: { show: true } },
    yaxis: { lines: { show: false } },
  };
  barHXaxis: any = {
    tickAmount: 4,
    labels: {
      formatter: (v: number) => {
        if (v === 0) return 'R$ 0';
        if (v >= 1000) return 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k';
        return 'R$ ' + Math.round(v);
      },
      style: { colors: '#94a3b8', fontSize: '11px' },
    },
  };
  barHYaxis: any = { labels: { style: { colors: '#64748b', fontSize: '12px' } } };
  barHTooltip: any = { y: { formatter: (v: number) => this.formatCurrency(v) } };


  tipos: { val: "PEDIDO" | "ORCAMENTO"; label: string }[] = [
    { val: "PEDIDO", label: "Venda" },
    { val: "ORCAMENTO", label: "Orçamento" },
  ];

  // ── Configuração DataTable ─────────────────────────────────
  readonly colunasPedidos: TableColumn[] = [
    {
      field: 'numero',
      header: 'N°',
      width: '8%',
      type: 'mono',
      valueFn: (p: PedidoResponse) => '#' + String(p.numero ?? 0).padStart(3, '0'),
    },
    { field: 'createdAt',   header: 'Data',     width: '12%', type: 'date' },
    { field: 'clienteNome', header: 'Cliente',   width: '20%', type: 'text' },
    {
      field: '__produtos',
      header: 'Produtos',
      width: '30%',
      type: 'computed',
      truncate: true,
      valueFn: (p: PedidoResponse) =>
        p.itens.map((i: any) => `${i.produtoNome} × ${i.quantidade}`).join(', '),
    },
    {
      field: 'valorBruto',
      header: 'Total',
      width: '14%',
      type: 'currency-with-badge',
      badgeFn: (p: PedidoResponse) => {
        const diff = Number(p.valorBruto) - Number(p.valorTotal);
        if (diff === 0) return null;
        if (diff > 0) return `-${diff.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
        return `+${Math.abs(diff).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
      },
    },
    {
      field: 'status',
      header: 'Status',
      width: '10%',
      type: 'tag',
      tagSeverityFn: (val: StatusPedido) => this.getSeverity(val),
      tagLabelFn:    (val: StatusPedido) => this.getStatusLabel(val),
    },
    {
      field: 'parcelaMesAtual',
      header: 'Parcelas',
      width: '11%',
      type: 'tag',
      tagSeverityFn: (parcela: ParcelaResponse | null) => {
        if (!parcela) return 'secondary';
        if (parcela.status === 'PAGO') return 'success';   // todas pagas
        if (parcela.dataVencimento) {
          const venc = new Date(parcela.dataVencimento + 'T12:00:00');
          if (venc < new Date()) return 'danger';           // próxima vencida
        }
        return 'warn';                                      // próxima pendente
      },
      tagLabelFn: (parcela: ParcelaResponse | null) => {
        if (!parcela) return '';
        if (parcela.status === 'PAGO') return `${parcela.totalParcelas}/${parcela.totalParcelas} pagas`;
        const pagas = parcela.numeroParcela - 1;
        return `${pagas}/${parcela.totalParcelas} pagas`;
      },
    },
    {
      field: 'entrega',
      header: 'Entrega',
      width: '10%',
      type: 'tag',
      cellClass: 'pl-6',
      tagSeverityFn: (entrega: EntregaResponse | null) => {
        if (!entrega) return 'secondary';
        return entrega.status === 'FEITA' ? 'success' : 'warn';
      },
      tagLabelFn: (entrega: EntregaResponse | null) => {
        if (!entrega) return '';
        return entrega.status === 'FEITA' ? 'Entregue' : 'Pendente';
      },
    },
  ];

  readonly acoesPedidos: TableActionConfig = {
    showView: true, showEdit: true, showDelete: true,
    showExportPdf: true, showExportTermica: true, useExportMenu: true,
    deleteHeader: 'Confirmar exclusão',
    deleteMessageFn: (p: PedidoResponse) =>
      `Deseja excluir a venda de ${p.clienteNome} no valor de ${Number(p.valorBruto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}?`,
  };

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

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    this.carregarPedidos();
    this.selectPeriodo('mes');
  }

  // ── Período ────────────────────────────────────────────────
  selectPeriodo(p: Periodo): void {
    this.periodoAtivo = p;
    if (p === 'custom') {
      this.customInicio = this.filtro.inicio;
      this.customFim    = this.filtro.fim;
    } else {
      this.aplicarPeriodo(p);
    }
  }

  private aplicarPeriodo(p: Periodo): void {
    const hoje = new Date();
    let start  = new Date(hoje);
    if (p === 'mes')       start = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    else if (p === 'trimestre') start.setMonth(hoje.getMonth() - 2);
    else if (p === 'semestre')  start.setMonth(hoje.getMonth() - 5);
    else if (p === 'ano')       start.setFullYear(hoje.getFullYear() - 1);
    this.filtro = { ...this.filtro, inicio: start.toISOString().split('T')[0], fim: hoje.toISOString().split('T')[0] };
    this.cdr.detectChanges();
    this.carregarKpis();
  }

  aplicarPeriodoCustom(): void {
    if (this.customInicio && this.customFim) {
      this.filtro = { ...this.filtro, inicio: this.customInicio, fim: this.customFim };
      this.cdr.detectChanges();
      this.carregarKpis();
    }
  }

  periodoButtonClass(value: Periodo): Record<string, boolean> {
    const active = this.periodoAtivo === value;
    return {
      'bg-blue-600 text-white font-semibold':           active,
      'text-gray-500 hover:bg-slate-100 font-medium':   !active,
      'px-3 py-1.5 text-xs rounded-lg transition-colors': true,
    };
  }

  carregarPedidos(): void {
    this.loading = true;
    this.service.getPedidos().subscribe({
      next: (pedidos) => {
        this.pedidos = pedidos;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loading = false;
        const detail = err?.error?.message ?? 'Não foi possível carregar as vendas.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
        this.cdr.detectChanges();
      },
    });
  }

  // ── KPIs ──────────────────────────────────────────────────
  private carregarKpis(): void {
    if (!this.filtro.inicio || !this.filtro.fim) return;
    this.service.getKpis({ inicio: this.filtro.inicio, fim: this.filtro.fim }).subscribe({
      next: valor => {
        this.vendasMes = Number(valor);
        this.cdr.detectChanges();
      },
    });
  }

  get totalRegistros(): number {
    return this.pedidos.length;
  }

  get totalPendentes(): number {
    return this.pedidos.filter(p => p.status === 'PENDENTE').length;
  }

  // ── Filtro client-side ─────────────────────────────────────
  get pedidosFiltrados(): PedidoResponse[] {
    return this.pedidos.filter((p) => {

      const matchStatus = this.filtro.status === 'TODOS' || p.status === this.filtro.status;
      const matchPgto   = this.filtro.formaPagamento === 'TODOS' || p.formaPagamento === this.filtro.formaPagamento;

      const data        = p.createdAt ? p.createdAt.split('T')[0] : '';
      const matchInicio = !this.filtro.inicio || data >= this.filtro.inicio;
      const matchFim    = !this.filtro.fim    || data <= this.filtro.fim;
      // Pedidos CONFIRMADO têm parcelas em aberto — sempre visíveis independente do período
      const matchPeriodo = p.status === 'CONFIRMADO' || (matchInicio && matchFim);

      const valor    = Number(p.valorTotal);
      const matchMin = this.filtro.minValor === null || valor >= this.filtro.minValor;
      const matchMax = this.filtro.maxValor === null || valor <= this.filtro.maxValor;

      return matchStatus && matchPgto && matchPeriodo && matchMin && matchMax;
    }).sort((a, b) => {
      const da = new Date(a.createdAt ?? 0).getTime();
      const db = new Date(b.createdAt ?? 0).getTime();
      return this.ordenacao === 'recente' ? db - da : da - db;
    });
  }

  get temFiltroAtivo(): boolean {
    const f = this.filtro;
    const temFiltroModal = f.status !== 'TODOS' || f.formaPagamento !== 'TODOS' || f.minValor !== null || f.maxValor !== null;
    const temPeriodoCustom = this.periodoAtivo === 'custom' && !!(f.inicio || f.fim);
    return temFiltroModal || temPeriodoCustom;
  }

  // ── Gráficos (reativos ao filtro) ─────────────────────────
  get donutSeries(): number[] {
    const soma = (fn: (p: PedidoResponse) => boolean) =>
      this.pedidosFiltrados.filter(fn).reduce((acc, p) => acc + Number(p.valorTotal), 0);
    return [
      soma(p => p.status === 'PAGO'),
      soma(p => p.status === 'CONFIRMADO'),
      soma(p => p.status === 'PENDENTE'),
      soma(p => p.status === 'CANCELADO'),
    ];
  }

  get donutTotal(): number {
    return this.donutSeries.reduce((a, b) => a + b, 0);
  }

  get barHSeries(): any[] {
    const mapa = new Map<string, number>();
    for (const p of this.pedidosFiltrados) {
      if (p.status !== 'PAGO') continue;
      mapa.set(p.clienteNome, (mapa.get(p.clienteNome) ?? 0) + Number(p.valorTotal));
    }
    const top6 = Array.from(mapa.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);
    return [{ name: 'Total', data: top6.map(([nome, valor]) => ({ x: nome, y: valor })) }];
  }

  // ── Modal Criar ────────────────────────────────────────────
  abrirModalCriar(): void {
    this.showModalCriar = true;
    this.loadingModal = true;
    forkJoin({
      produtos: this.service.getProdutos(),
      clientes: this.service.getClientes(),
    }).subscribe({
      next: ({ produtos, clientes }) => {
        this.produtos = produtos;
        this.clientes = clientes;
        this.loadingModal = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loadingModal = false;
        const detail = err?.error?.message ?? 'Não foi possível carregar os dados.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
        this.cdr.detectChanges();
      },
    });
  }

  fecharModalCriar(): void {
    this.showModalCriar = false;
  }

  onPedidoCriado(pedido: PedidoResponse): void {
    this.pedidos = [pedido, ...this.pedidos];
    this.showModalCriar = false;
    this.messageService.add({
      severity: 'success',
      summary: 'Pedido criado',
      detail: `Venda para ${pedido.clienteNome} registrada com sucesso`,
      life: 3000,
    });
    this.cdr.detectChanges();
  }

  // ── Modal Detalhe ──────────────────────────────────────────
  abrirDetalhe(pedido: PedidoResponse): void {
    this.pedidoSelecionado = pedido;
    this.showModalDetalhe = true;
  }

  fecharDetalhe(): void {
    this.showModalDetalhe = false;
    this.pedidoSelecionado = null;
  }

  onPagar(id: string): void {
    this.salvando = true;
    this.service.patchPagarPedido(id).subscribe({
      next: (pedidoAtualizado) => {
        this.atualizarNaLista(pedidoAtualizado);
        this.salvando = false;
        this.fecharDetalhe();
        this.messageService.add({
          severity: 'success',
          summary: 'Pago',
          detail: 'Pagamento registrado com sucesso',
          life: 3000,
        });
        this.cdr.detectChanges();
        this.carregarKpis();
      },
      error: (err) => {
        this.salvando = false;
        const detail = err?.error?.message ?? 'Não foi possível registrar o pagamento';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
        this.cdr.detectChanges();
      },
    });
  }

  onEntregaMarcada(entrega: EntregaResponse): void {
    if (!this.pedidoSelecionado) return;
    const id = this.pedidoSelecionado.id;
    this.pedidos = this.pedidos.map(p =>
      p.id === id ? { ...p, entrega } : p
    );
    this.cdr.detectChanges();
  }

  onParcelaPaga(proxima: ParcelaResponse | null): void {
    if (!this.pedidoSelecionado) return;
    const id = this.pedidoSelecionado.id;
    this.pedidos = this.pedidos.map(p =>
      p.id === id ? { ...p, parcelaMesAtual: proxima } : p
    );
    this.cdr.detectChanges();
    this.carregarKpis();
  }

  onConfirmarPedido(id: string): void {
    this.salvando = true;
    this.service.patchConfirmarPedido(id).subscribe({
      next: (pedidoAtualizado) => {
        this.atualizarNaLista(pedidoAtualizado);
        this.salvando = false;
        this.fecharDetalhe();
        this.carregarKpis();
        this.messageService.add({
          severity: 'success',
          summary: 'Confirmado',
          detail: 'Orçamento convertido em venda com sucesso',
          life: 3000,
        });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.salvando = false;
        const detail = err?.error?.message ?? 'Não foi possível confirmar o orçamento';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
        this.cdr.detectChanges();
      },
    });
  }

  onCancelar(id: string): void {
    this.salvando = true;
    this.service.patchCancelarPedido(id).subscribe({
      next: (pedidoAtualizado) => {
        this.atualizarNaLista(pedidoAtualizado);
        this.salvando = false;
        this.fecharDetalhe();
        this.messageService.add({
          severity: 'warn',
          summary: 'Cancelado',
          detail: 'Pedido cancelado',
          life: 3000,
        });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.salvando = false;
        const detail = err?.error?.message ?? 'Não foi possível cancelar o pedido';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
        this.cdr.detectChanges();
      },
    });
  }


  // --- Modal Edição ----------------------

  abrirEdicao(pedido: PedidoResponse): void {
    this.pedidoSelecionado = pedido;
    this.showModalEdicao = true;
  }

  fecharEdicao(): void {
    this.showModalEdicao = false;
    this.pedidoSelecionado = null;
  }

  onSalvarEdicao(pedido: PedidoAtualizarRequest): void {
    const id = this.pedidoSelecionado!.id;
    this.onEditar(id, pedido);
  }

  onEditar(id: string, pedido: PedidoAtualizarRequest): void {
    this.salvando = true;
    this.service.putEditarVenda(id, pedido).subscribe ({
      next: (pedidoAtualizado) => {
        this.atualizarNaLista(pedidoAtualizado);
        this.salvando = false;
        this.fecharEdicao();
        this.messageService.add({
          severity: 'success',
          summary: 'Editado',
          detail: 'Pagamento registrado com sucesso',
          life: 3000,
        });
        this.cdr.detectChanges();
      }, 
        error: (err: any) => {
          this.salvando = false;
          const detail = err?.error?.message ?? 'Erro ao editar venda';
          this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
          this.cdr.detectChanges();
        },
    });
  }

  // ── Excluir Pedido ─────────────────────────────────────────
  onExcluirPedido(pedido: PedidoResponse): void {
    this.service.deletePedido(pedido.id).subscribe({
      next: () => {
        this.pedidos = this.pedidos.filter(p => p.id !== pedido.id);
        this.carregarKpis();
        this.messageService.add({
          severity: 'success',
          summary: 'Excluído',
          detail: `Venda de ${pedido.clienteNome} excluída com sucesso`,
          life: 3000,
        });
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        const detail = err?.error?.message ?? 'Não foi possível excluir a venda';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
        this.cdr.detectChanges();
      },
    });
  }

  // ── Modal Filtros ──────────────────────────────────────────
  abrirModalFiltros(): void {
    this.showModalFiltros = true;
  }


  fecharModalFiltros(): void {
    this.showModalFiltros = false;
  }

  onAplicarFiltros(filtros: VendasFiltroCompleto): void {
    this.filtro = filtros;
    this.showModalFiltros = false;
  }

  onLimparFiltros(): void {
    this.filtro = { status: 'TODOS', formaPagamento: 'TODOS', inicio: '', fim: '', minValor: null, maxValor: null };
    this.showModalFiltros = false;
    this.periodoAtivo = 'mes';
    this.selectPeriodo('mes');
  }

  aplicarFiltroCustom(): void {
    if (this.filtro.inicio && this.filtro.fim) this.cdr.detectChanges();
  }

  
  limparFiltroButtonClass(_: Periodo): Record<string, boolean> {
    return {
      'px-3 py-1.5 text-xs rounded-lg transition-colors font-medium': true,
      'text-red-500 hover:bg-red-50 border border-red-200': true,
    };
  }


  // ── Exportar (busca dados completos antes de imprimir) ────────
  exportarPedido(row: PedidoResponse, formato: ExportFormato): void {
    this.service.getByPedidoId(row.id).subscribe({
      next: pedido => this.exportService.imprimirPedido(pedido, formato),
      error: () => this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar o pedido para exportação', life: 4000 }),
    });
  }

  // ── Helpers ────────────────────────────────────────────────
  private atualizarNaLista(pedidoAtualizado: PedidoResponse): void {
    this.pedidos = this.pedidos.map((p) =>
      p.id === pedidoAtualizado.id ? pedidoAtualizado : p
    );
  }

  numeroVenda(index: number): string {
    return 'V' + String(index + 1).padStart(3, '0');
  }

  formatCurrency(v: number): string {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatData(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  formatProdutos(pedido: PedidoResponse): string {
    return pedido.itens.map((i) => `${i.produtoNome} × ${i.quantidade}`).join(', ');
  }

  statusBadgeClass(status: StatusPedido): Record<string, boolean> {
    return {
      'px-2.5 py-1 rounded-lg text-xs font-semibold': true,
      'bg-green-100 text-green-700': status === 'PAGO',
      'bg-yellow-100 text-yellow-700': status === 'CONFIRMADO' || status === 'PENDENTE',
      'bg-gray-100 text-gray-600': status === 'ORCAMENTO',
      'bg-red-100 text-red-600': status === 'CANCELADO',
    };
  }

  
}
