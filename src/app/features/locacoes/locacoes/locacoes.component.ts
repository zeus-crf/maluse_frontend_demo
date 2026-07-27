import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  NgApexchartsModule,
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexPlotOptions,
  ApexTooltip,
  ApexNonAxisChartSeries,
  ApexLegend,
} from 'ng-apexcharts';
import { forkJoin } from 'rxjs';
import { MessageService } from 'primeng/api';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { TableColumn, TableActionConfig } from '../../../shared/components/data-table/data-table.models';
import { LocacaoService } from './locacoes.service';
import {
  ClienteSimples,
  EntregaResponse,
  LocacaoResponse,
  LocacoesFiltroCompleto,
  ParcelaResponse,
  ProdutoSimples,
  StatusLocacao,
} from '../models/locacoes.models';

import { NovaLocacaoModalComponent } from "../nova-locacao-modal/nova-locacao-modal.component";
import { LocacaoDetalheModalComponent } from "../locacao-datalhe-modal/locacao-detalhe-modal.component";
import { LocacaoEdicaoModalComponent } from "../locacao-edicao-modal/locacao-edicao-modal.component";
import { LocacaoFiltrosModalComponent } from "../locacao-filtros-modal/locacao-filtros-modal.component";
import { LocacaoEdicaoPayload } from "./locacoes.service";
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { SelectComponent } from '../../../shared/components/select/select.component';
import { ExportService, ExportFormato } from '../../../shared/services/export.service';

type Periodo = 'mes' | 'trimestre' | 'semestre' | 'ano' | 'custom';

@Component({
  selector: 'app-locacoes',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule, DataTableComponent, NovaLocacaoModalComponent, LocacaoDetalheModalComponent, LocacaoEdicaoModalComponent, LocacaoFiltrosModalComponent, DatePickerComponent, SelectComponent],
  templateUrl: './locacoes.component.html',
  styleUrl: './locacoes.component.scss',
})
export class LocacoesComponent implements OnInit {

  private cdr            = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  private service        = inject(LocacaoService);
  exportService          = inject(ExportService);

  // ── Dados ──────────────────────────────────────────────────
  locacoes: LocacaoResponse[] = [];
  produtos: ProdutoSimples[]  = [];
  clientes: ClienteSimples[]  = [];

  // ── Loading ────────────────────────────────────────────────
  loading      = true;
  salvando     = false;
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
  readonly opcoesOrdenacao = [
    { value: 'recente', label: 'Mais recentes' },
    { value: 'antigo',  label: 'Mais antigos'  },
  ];
  ordenacao: 'recente' | 'antigo' = 'recente';

  filtro: LocacoesFiltroCompleto = {
    status: 'TODOS', formaPagamento: 'TODOS',
    inicio: '', fim: '', minValor: null, maxValor: null,
  };

  // ── Modais ─────────────────────────────────────────────────
  showModalCriar   = false;
  showModalDetalhe = false;
  showModalEdicao  = false;
  showModalFiltros = false;
  locacaoSelecionada: LocacaoResponse | null = null;
  salvandoEdicao = false;

  // ── Configuração DataTable ─────────────────────────────────
  readonly colunasLocacoes: TableColumn[] = [
    {
      field: 'numero',
      header: 'N°',
      width: '7%',
      type: 'mono',
      valueFn: (l: LocacaoResponse) => '#' + String(l.numero ?? 0).padStart(3, '0'),
    },
    { field: 'clienteNome',          header: 'Cliente',    width: '16%', type: 'text' },
    {
      field: '__equipamentos',
      header: 'Equipamentos',
      width: '26%',
      type: 'computed',
      truncate: true,
      valueFn: (l: LocacaoResponse) =>
        l.itens.map(i => `${i.produtoNome} × ${i.quantidade}`).join(', '),
    },
    { field: 'dataRetirada',          header: 'Retirada',   width: '11%', type: 'date' },
    { field: 'dataDevolucaoPrevista', header: 'Devolução',  width: '11%', type: 'date' },
    {
      field: '__diasRestantes',
      header: 'Prazo',
      width: '10%',
      type: 'computed',
      valueFn: (l: LocacaoResponse) => this.prazoLabel(l),
    },
    {
      field: 'valorBruto',
      header: 'Total',
      width: '12%',
      type: 'currency-with-badge',
      badgeFn: (l: LocacaoResponse) => {
        const diff = Number(l.valorBruto) - Number(l.valorTotal);
        if (diff === 0) return null;
        if (diff > 0) return `-${diff.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
        return `+${Math.abs(diff).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
      },
    },
    {
      field: 'status',
      header: 'Status',
      width: '12%',
      type: 'tag',
      tagSeverityFn: (val: StatusLocacao) => this.getSeverity(val),
      tagLabelFn:    (val: StatusLocacao) => this.getStatusLabel(val),
    },
    {
      field: 'parcelaMesAtual',
      header: 'Parcelas',
      width: '11%',
      type: 'tag',
      tagSeverityFn: (parcela: ParcelaResponse | null) => {
        if (!parcela) return 'secondary';
        if (parcela.status === 'PAGO') return 'success';
        if (parcela.dataVencimento) {
          const venc = new Date(parcela.dataVencimento + 'T12:00:00');
          if (venc < new Date()) return 'danger';
        }
        return 'warn';
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

  readonly acoesLocacoes: TableActionConfig = {
    showExtra:         true,
    extraIcon:         'pi pi-pencil',
    extraTooltip:      'Editar',
    showView:          true,
    showEdit:          false,
    showDelete:        false,
    showApagar:        true,
    showExportPdf:     true,
    showExportTermica: true,
    useExportMenu:     true,
    apagarIcon:   'pi pi-trash',
    apagarTooltip: 'Apagar',
    apagarHeader: 'Apagar permanentemente',
    apagarAcceptLabel: 'Apagar',
    apagarMessageFn: (l: LocacaoResponse) =>
      `Apagar a locação de ${l.clienteNome}? Esta ação não pode ser desfeita.`,
  };

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    this.carregarLocacoes();
    this.selectPeriodo('mes');
  }

  // ── Carregamento ───────────────────────────────────────────
  carregarLocacoes(): void {
    this.loading = true;
    this.service.getLocacoes().subscribe({
      next: (locacoes) => {
        this.locacoes = locacoes;
        this.loading  = false;
        this.recalcularGraficos();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loading = false;
        const detail = err?.error?.message ?? 'Não foi possível carregar as locações.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
        this.cdr.detectChanges();
      },
    });
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
    const hoje  = new Date();
    let   start = new Date(hoje);
    // Para "este mês" o fim é o último dia do mês (inclui locações com retirada futura no mesmo mês).
    // Para os demais períodos o fim é hoje (janelas retroativas).
    let   fim   = new Date(hoje);
    if (p === 'mes') {
      start = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      fim   = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0); // último dia do mês
    } else if (p === 'trimestre') {
      start.setMonth(hoje.getMonth() - 2);
    } else if (p === 'semestre') {
      start.setMonth(hoje.getMonth() - 5);
    } else if (p === 'ano') {
      start.setFullYear(hoje.getFullYear() - 1);
    }
    this.filtro = {
      ...this.filtro,
      inicio: start.toISOString().split('T')[0],
      fim:    fim.toISOString().split('T')[0],
    };
    this.recalcularGraficos();
    this.carregarKpis();
    this.cdr.detectChanges();
  }

  aplicarPeriodoCustom(): void {
    if (this.customInicio && this.customFim) {
      this.filtro = { ...this.filtro, inicio: this.customInicio, fim: this.customFim };
      this.recalcularGraficos();
      this.carregarKpis();
      this.cdr.detectChanges();
    }
  }

  periodoButtonClass(value: Periodo): Record<string, boolean> {
    const active = this.periodoAtivo === value;
    return {
      'bg-blue-600 text-white font-semibold':          active,
      'text-gray-500 hover:bg-slate-100 font-medium':  !active,
      'px-3 py-1.5 text-xs rounded-lg transition-colors': true,
    };
  }

    limparFiltroButtonClass(_: Periodo): Record<string, boolean> {
    return {
      'px-3 py-1.5 text-xs rounded-lg transition-colors font-medium': true,
      'text-red-500 hover:bg-red-50 border border-red-200': true,
    };
  }


  // ── KPIs ──────────────────────────────────────────────────
  // Todos reagem ao período selecionado (e a pagamento/valor/busca).
  // A tabela mostra mais porque não tem filtro de período — intencional para urgência.
  get totalAtivas(): number {
    // Conta todas as ATIVA — estado atual, independe do período selecionado
    return this.locacoes.filter(l => l.status === 'ATIVA').length;
  }

  get totalAtrasadas(): number {
    // Conta todas as ATRASADA — estado atual, independe do período selecionado
    return this.locacoes.filter(l => this.isAtrasada(l)).length;
  }

  get totalDevolvidas(): number {
    // Devolvidas sim respeitam o período — é dado histórico
    return this.locacoesParaKPIs.filter(l => l.status === 'DEVOLVIDA').length;
  }

  faturamentoMes = 0;

  private carregarKpis(): void {
    if (!this.filtro.inicio || !this.filtro.fim) return;
    this.service.getKpis({ inicio: this.filtro.inicio, fim: this.filtro.fim }).subscribe({
      next: valor => {
        this.faturamentoMes = Number(valor);
        this.cdr.detectChanges();
      },
      error: err => console.error('[Locações KPI]', err),
    });
  }

  // ── Gráficos (ApexCharts — cacheados) ─────────────────────
  barSeries:      ApexAxisChartSeries  = [{ name: 'Faturamento', data: [] }];
  barXAxis:       ApexXAxis            = { categories: [] };
  barChart:       ApexChart            = {
    type: 'bar', height: 200, toolbar: { show: false }, fontFamily: 'inherit',
  };
  barPlotOptions: ApexPlotOptions      = { bar: { borderRadius: 3, columnWidth: '60%', borderRadiusApplication: 'end' } };
  barTooltip:     ApexTooltip          = {
    y: { formatter: (v: number) =>
      Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
  };
  barDataLabels:  any = { enabled: false };
  barGrid:        any = { borderColor: '#f1f5f9', strokeDashArray: 4 };
  barYAxis:       any = { labels: { formatter: (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`, style: { colors: '#94a3b8', fontSize: '11px' } } };

  donutSeries:      ApexNonAxisChartSeries = [];
  donutLabels:      string[]               = [];
  donutColors:      string[]               = [];
  donutChart:       ApexChart              = {
    type: 'donut', height: 200, toolbar: { show: false }, fontFamily: 'inherit',
  };
  donutLegend:      ApexLegend = { position: 'bottom', fontSize: '11px' };
  donutDataLabels:  any        = { enabled: false };
  donutPlotOptions: any        = { pie: { donut: { size: '65%' } } };
  donutStroke:      any        = { width: 0 };

  recalcularGraficos(): void {
    this.recalcularBarFaturamento();
    this.recalcularDonutStatus();
    this.cdr.detectChanges();
  }

  private recalcularBarFaturamento(): void {
    const inicio = this.filtro.inicio;
    const fim    = this.filtro.fim;
    const diasPeriodo = (inicio && fim)
      ? Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 86_400_000)
      : 365;
    const granularidade: 'dia' | 'mes' = diasPeriodo <= 31 ? 'dia' : 'mes';

    const buckets = new Map<string, number>();
    for (const l of this.locacoesParaGraficos) {
      // Bar chart mostra apenas locações efetivamente pagas (devolvidas)
      if (l.status !== 'DEVOLVIDA') continue;
      // Agrupa pela data real de devolução (= data em que o pagamento foi confirmado)
      const dataRef = l.dataDevolucaoReal ?? '';
      if (!dataRef) continue;
      if (this.filtro.inicio && dataRef < this.filtro.inicio) continue;
      if (this.filtro.fim    && dataRef > this.filtro.fim)    continue;
      const chave = this.bucketKey(dataRef, granularidade);
      buckets.set(chave, (buckets.get(chave) ?? 0) + Number(l.valorTotal));
    }

    // No modo mensal preenche meses sem registro para manter continuidade do eixo.
    // No modo diário exibe apenas os dias com registro para evitar sobreposição de labels.
    if (inicio && fim && granularidade === 'mes') {
      const cur = new Date(inicio);
      const end = new Date(fim);
      while (cur <= end) {
        const k = this.bucketKey(cur.toISOString().split('T')[0], granularidade);
        if (!buckets.has(k)) buckets.set(k, 0);
        cur.setMonth(cur.getMonth() + 1);
      }
    }

    const chaves  = [...buckets.keys()].sort();
    const labels  = chaves.map(c => this.bucketLabel(c, granularidade));
    const isDia   = granularidade === 'dia';

    this.barXAxis  = {
      categories: labels,
      axisBorder: { show: false },
      axisTicks:  { show: false },
      labels: {
        rotate:                isDia ? -45 : 0,
        rotateAlways:          isDia,
        hideOverlappingLabels: true,
        style: { colors: '#94a3b8', fontSize: isDia ? '10px' : '12px' },
      },
    };
    this.barSeries = [{ name: 'Faturamento', data: chaves.map(c => +(buckets.get(c) ?? 0).toFixed(2)) }];
  }

  private recalcularDonutStatus(): void {
    const colorMap: Record<string, string> = {
      ATIVA:     '#2563eb',
      ATRASADA:  '#ef4444',
      DEVOLVIDA: '#22c55e',
      CANCELADA: '#94a3b8',
      ORCAMENTO: '#f59e0b',
    };
    const labelMap: Record<string, string> = {
      ATIVA: 'Ativa', ATRASADA: 'Atrasada',
      DEVOLVIDA: 'Devolvida', CANCELADA: 'Cancelada', ORCAMENTO: 'Orçamento',
    };
    const counts: Record<string, number> = {
      ATIVA:     this.locacoesParaGraficos.filter(l => l.status === 'ATIVA').length,
      ATRASADA:  this.locacoesParaGraficos.filter(l => l.status === 'ATRASADA').length,
      DEVOLVIDA: this.locacoesParaGraficos.filter(l => l.status === 'DEVOLVIDA').length,
      CANCELADA: this.locacoesParaGraficos.filter(l => l.status === 'CANCELADA').length,
      ORCAMENTO: this.locacoesParaGraficos.filter(l => l.status === 'ORCAMENTO').length,
    };
    const entries = Object.entries(counts).filter(([, v]) => v > 0);
    this.donutSeries = entries.map(([, v]) => v);
    this.donutLabels = entries.map(([k]) => labelMap[k]);
    this.donutColors = entries.map(([k]) => colorMap[k]);
  }

  /** Gera a chave do bucket para uma data ISO */
  private bucketKey(iso: string, g: 'dia' | 'mes'): string {
    if (g === 'dia') return iso.slice(0, 10);
    return iso.slice(0, 7);
  }

  /** Formata a chave do bucket em label legível */
  private bucketLabel(chave: string, g: 'dia' | 'mes'): string {
    if (g === 'dia') {
      const date = new Date(chave + 'T00:00:00');
      return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
    const [ano, mes] = chave.split('-');
    return new Date(+ano, +mes - 1)
      .toLocaleString('pt-BR', { month: 'short' })
      .replace('.', '')
      .replace(/^\w/, c => c.toUpperCase());
  }

  // ── Alertas de urgência ────────────────────────────────────
  /** Locações atrasadas: status ATRASADA ou ATIVA com devolução vencida */
  get alertasAtrasadas(): LocacaoResponse[] {
    const hoje = this.hoje();
    return this.locacoes.filter(l =>
      l.status === 'ATRASADA' ||
      (l.status === 'ATIVA' && l.dataDevolucaoPrevista < hoje)
    );
  }

  /** Locações ATIVAS que vencem nos próximos 3 dias (sem contar as já vencidas) */
  get alertasVencendo(): LocacaoResponse[] {
    const hoje  = this.hoje();
    const em3   = this.diasAPartirDeHoje(3);
    return this.locacoes.filter(l =>
      l.status === 'ATIVA' &&
      l.dataDevolucaoPrevista >= hoje &&
      l.dataDevolucaoPrevista <= em3
    );
  }

  get temAlertas(): boolean {
    return this.alertasAtrasadas.length > 0 || this.alertasVencendo.length > 0;
  }

  // ── Filtro client-side ─────────────────────────────────────
  // Tabela: aplica todos os filtros incluindo período.
  // Locações atrasadas de meses anteriores já aparecem nos alertas de urgência no topo.
  get locacoesFiltradas(): LocacaoResponse[] {
    return this.locacoes.filter(l => {

      const matchStatus = this.filtro.status === 'TODOS' || l.status === this.filtro.status;
      const matchPgto   = this.filtro.formaPagamento === 'TODOS' || l.formaPagamento === this.filtro.formaPagamento;

      const dataRef = l.status === 'ORCAMENTO'
        ? (l.createdAt ? l.createdAt.split('T')[0] : null)
        : l.status === 'DEVOLVIDA'
        ? (l.dataDevolucaoReal ?? l.dataRetirada ?? '')   // usa data real de devolução
        : (l.dataRetirada ?? '');
      const matchInicio = dataRef === null || !this.filtro.inicio || dataRef >= this.filtro.inicio;
      const matchFim    = dataRef === null || !this.filtro.fim    || dataRef <= this.filtro.fim;
      // ATIVA e ATRASADA sempre visíveis — podem ter parcelas pendentes de qualquer período
      const matchPeriodo = l.status === 'ATIVA' || l.status === 'ATRASADA' || (matchInicio && matchFim);

      const valor    = Number(l.valorTotal);
      const matchMin = this.filtro.minValor === null || valor >= this.filtro.minValor;
      const matchMax = this.filtro.maxValor === null || valor <= this.filtro.maxValor;

      return matchStatus && matchPgto && matchPeriodo && matchMin && matchMax;
    }).sort((a, b) => {
      const da = new Date(a.createdAt ?? 0).getTime();
      const db = new Date(b.createdAt ?? 0).getTime();
      return this.ordenacao === 'recente' ? db - da : da - db;
    });
  }

  // Gráficos: igual à tabela + filtro de período + filtro de status
  private get locacoesParaGraficos(): LocacaoResponse[] {
    return this.locacoes.filter(l => {
      const matchStatus = this.filtro.status === 'TODOS' || l.status === this.filtro.status;
      const matchPgto   = this.filtro.formaPagamento === 'TODOS' || l.formaPagamento === this.filtro.formaPagamento;

      // ORCAMENTO usa createdAt; DEVOLVIDA usa dataDevolucaoReal; demais usam dataRetirada
      const dataRef = l.status === 'ORCAMENTO'
        ? (l.createdAt ? l.createdAt.split('T')[0] : null)
        : l.status === 'DEVOLVIDA'
        ? (l.dataDevolucaoReal ?? l.dataRetirada ?? '')
        : (l.dataRetirada ?? '');
      const matchInicio = dataRef === null || !this.filtro.inicio || dataRef >= this.filtro.inicio;
      const matchFim    = dataRef === null || !this.filtro.fim    || dataRef <= this.filtro.fim;
      // ATIVA e ATRASADA sempre presentes no donut — representam o estado atual
      const matchPeriodo = l.status === 'ATIVA' || l.status === 'ATRASADA' || (matchInicio && matchFim);

      const valor    = Number(l.valorTotal);
      const matchMin = this.filtro.minValor === null || valor >= this.filtro.minValor;
      const matchMax = this.filtro.maxValor === null || valor <= this.filtro.maxValor;

      return matchStatus && matchPgto && matchPeriodo && matchMin && matchMax;
    });
  }

  // KPIs: período + pagamento + valor + busca — SEM filtro de status
  // (cada KPI já filtra pelo seu próprio status; assim totalAtrasadas não zera
  //  quando o usuário filtra por status=ATIVA na tabela)
  private get locacoesParaKPIs(): LocacaoResponse[] {
    return this.locacoes.filter(l => {
      const matchPgto   = this.filtro.formaPagamento === 'TODOS' || l.formaPagamento === this.filtro.formaPagamento;

      const dataRef = l.status === 'ORCAMENTO'
        ? (l.createdAt ? l.createdAt.split('T')[0] : null)
        : l.status === 'DEVOLVIDA'
        ? (l.dataDevolucaoReal ?? l.dataRetirada ?? '')
        : (l.dataRetirada ?? '');
      const matchInicio = dataRef === null || !this.filtro.inicio || dataRef >= this.filtro.inicio;
      const matchFim    = dataRef === null || !this.filtro.fim    || dataRef <= this.filtro.fim;
      // ATIVA e ATRASADA sempre contam nos KPIs — representam o estado atual
      const matchPeriodo = l.status === 'ATIVA' || l.status === 'ATRASADA' || (matchInicio && matchFim);

      const valor    = Number(l.valorTotal);
      const matchMin = this.filtro.minValor === null || valor >= this.filtro.minValor;
      const matchMax = this.filtro.maxValor === null || valor <= this.filtro.maxValor;

      return matchPgto && matchPeriodo && matchMin && matchMax;
    });
  }

  get temFiltroAtivo(): boolean {
    const f = this.filtro;
    const temFiltroModal   = f.status !== 'TODOS' || f.formaPagamento !== 'TODOS' || f.minValor !== null || f.maxValor !== null;
    const temPeriodoCustom = this.periodoAtivo === 'custom' && !!(f.inicio || f.fim);
    return temFiltroModal || temPeriodoCustom;
  }

  // ── Modal Criar ────────────────────────────────────────────
  abrirModalCriar(): void {
    this.showModalCriar = true;
    this.loadingModal   = true;
    forkJoin({
      produtos: this.service.getProdutos(),
      clientes: this.service.getClientes(),
    }).subscribe({
      next: ({ produtos, clientes }) => {
        this.produtos     = produtos;
        this.clientes     = clientes;
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

  onLocacaoCriada(locacao: LocacaoResponse): void {
    this.locacoes = [locacao, ...this.locacoes];
    this.showModalCriar = false;
    this.recalcularGraficos();
    this.messageService.add({
      severity: 'success',
      summary: 'Locação criada',
      detail: `Locação para ${locacao.clienteNome} registrada com sucesso`,
      life: 3000,
    });
    this.cdr.detectChanges();
  }

  // ── Exportar (busca dados completos antes de imprimir) ────────
  exportarLocacao(row: LocacaoResponse, formato: ExportFormato): void {
    this.service.getLocacaoById(row.id).subscribe({
      next: locacao => this.exportService.imprimirLocacao(locacao, formato),
      error: () => this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar a locação para exportação', life: 4000 }),
    });
  }

  // ── Modal Detalhe ──────────────────────────────────────────
  abrirDetalhe(locacao: LocacaoResponse): void {
    this.locacaoSelecionada  = locacao;
    this.showModalDetalhe = true;
  }

  fecharDetalhe(): void {
    this.showModalDetalhe    = false;
    this.locacaoSelecionada  = null;
  }

  onEntregaMarcada(entrega: EntregaResponse): void {
    if (!this.locacaoSelecionada) return;
    const id = this.locacaoSelecionada.id;
    this.locacoes = this.locacoes.map(l =>
      l.id === id ? { ...l, entrega } : l
    );
    this.cdr.detectChanges();
  }

  onParcelaPaga(): void {
    this.carregarKpis();
  }

  // ── Modal Edição ───────────────────────────────────────────
  abrirModalEdicao(locacao: LocacaoResponse): void {
    this.locacaoSelecionada = locacao;
    this.showModalEdicao    = true;
  }

  fecharModalEdicao(): void {
    this.showModalEdicao    = false;
    this.locacaoSelecionada = null;
  }

  onLocacaoEditada(payload: LocacaoEdicaoPayload): void {
    if (!this.locacaoSelecionada) return;
    this.salvandoEdicao = true;
    this.service.patchEditar(this.locacaoSelecionada.id, payload).subscribe({
      next: (atualizada) => {
        this.atualizarNaLista(atualizada);
        this.salvandoEdicao = false;
        this.showModalEdicao = false;
        this.locacaoSelecionada = null;
        this.recalcularGraficos();
        this.messageService.add({
          severity: 'success',
          summary: 'Atualizado',
          detail: `Locação de ${atualizada.clienteNome} atualizada`,
          life: 3000,
        });
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.salvandoEdicao = false;
        const detail = err?.error?.message ?? 'Não foi possível atualizar a locação';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
        this.cdr.detectChanges();
      },
    });
  }

  // ── Modal Filtros ──────────────────────────────────────────
  abrirModalFiltros(): void  { this.showModalFiltros = true; }
  fecharModalFiltros(): void { this.showModalFiltros = false; }

  onAplicarFiltros(filtros: LocacoesFiltroCompleto): void {
    this.filtro = filtros;
    this.showModalFiltros = false;
    this.recalcularGraficos();
  }

  onLimparFiltros(): void {
    this.filtro = { status: 'TODOS', formaPagamento: 'TODOS', inicio: '', fim: '', minValor: null, maxValor: null };
    this.showModalFiltros = false;
    this.selectPeriodo('mes');
  }

  onConfirmarLocacao(locacao: LocacaoResponse): void {
    this.salvando = true;
    this.service.patchConfirmar(locacao.id).subscribe({
      next: (atualizada) => {
        this.atualizarNaLista(atualizada);
        this.salvando = false;
        this.fecharDetalhe();
        this.carregarKpis();
        this.recalcularGraficos();
        this.messageService.add({
          severity: 'success',
          summary: 'Confirmado',
          detail: 'Orçamento convertido em locação com sucesso',
          life: 3000,
        });
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.salvando = false;
        const detail = err?.error?.message ?? 'Não foi possível confirmar o orçamento';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
        this.cdr.detectChanges();
      },
    });
  }

  // ── Ações da tabela ────────────────────────────────────────
  onDevolver(locacao: LocacaoResponse): void {
    if (locacao.status !== 'ATIVA' && locacao.status !== 'ATRASADA') {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atenção',
        detail: 'Apenas locações ativas ou atrasadas podem ser devolvidas',
        life: 3000,
      });
      return;
    }
    this.salvando = true;
    this.service.patchDevolver(locacao.id).subscribe({
      next: (atualizada) => {
        this.atualizarNaLista(atualizada);
        this.salvando = false;
        this.recalcularGraficos();
        this.carregarKpis();
        this.messageService.add({
          severity: 'success',
          summary: 'Devolvido',
          detail: `Locação de ${atualizada.clienteNome} devolvida com sucesso`,
          life: 3000,
        });
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.salvando = false;
        const detail = err?.error?.message ?? 'Não foi possível registrar a devolução';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
        this.cdr.detectChanges();
      },
    });
  }

  onApagar(locacao: LocacaoResponse): void {
    this.salvando = true;
    this.service.deletar(locacao.id).subscribe({
      next: () => {
        this.locacoes = this.locacoes.filter(l => l.id !== locacao.id);
        this.salvando = false;
        this.recalcularGraficos();
        this.carregarKpis();
        this.messageService.add({
          severity: 'info',
          summary: 'Apagado',
          detail: `Locação de ${locacao.clienteNome} removida permanentemente`,
          life: 3000,
        });
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.salvando = false;
        const detail = err?.error?.message ?? 'Não foi possível apagar a locação';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
        this.cdr.detectChanges();
      },
    });
  }

  onCancelar(locacao: LocacaoResponse): void {
    this.salvando = true;
    this.service.patchCancelar(locacao.id).subscribe({
      next: (atualizada) => {
        this.atualizarNaLista(atualizada);
        this.salvando = false;
        this.recalcularGraficos();
        this.messageService.add({
          severity: 'warn',
          summary: 'Cancelado',
          detail: `Locação de ${atualizada.clienteNome} cancelada`,
          life: 3000,
        });
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.salvando = false;
        const detail = err?.error?.message ?? 'Não foi possível cancelar a locação';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
        this.cdr.detectChanges();
      },
    });
  }

  // ── Helpers ────────────────────────────────────────────────
  private atualizarNaLista(atualizada: LocacaoResponse): void {
    this.locacoes = this.locacoes.map(l => l.id === atualizada.id ? atualizada : l);
  }

  formatCurrency(v: number): string {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /** Retorna '+N dias' se atrasada, 'Hoje', ou 'N dias' se no prazo */
  prazoLabel(l: LocacaoResponse): string {
    if (l.status === 'DEVOLVIDA' || l.status === 'CANCELADA') return '—';
    const hoje  = new Date(this.hoje());
    const prev  = new Date(l.dataDevolucaoPrevista);
    const diff  = Math.round((prev.getTime() - hoje.getTime()) / 86_400_000);
    if (diff < 0)  return `+${Math.abs(diff)}d atraso`;
    if (diff === 0) return 'Hoje';
    return `${diff}d restantes`;
  }

  isAtrasada(l: LocacaoResponse): boolean {
    return l.status === 'ATRASADA' ||
      (l.status === 'ATIVA' && l.dataDevolucaoPrevista < this.hoje());
  }

  diasEmAtraso(l: LocacaoResponse): number {
    const hoje = new Date(this.hoje());
    const prev = new Date(l.dataDevolucaoPrevista);
    return Math.max(0, Math.round((hoje.getTime() - prev.getTime()) / 86_400_000));
  }

  diasParaVencer(l: LocacaoResponse): number {
    const hoje = new Date(this.hoje());
    const prev = new Date(l.dataDevolucaoPrevista);
    return Math.max(0, Math.round((prev.getTime() - hoje.getTime()) / 86_400_000));
  }

  getSeverity(status: StatusLocacao): 'success' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'ATIVA':      return 'success';
      case 'DEVOLVIDA':  return 'secondary';
      case 'ATRASADA':   return 'danger';
      case 'CANCELADA':  return 'warn';
      case 'ORCAMENTO': return 'secondary'
    }
  }

  getStatusLabel(status: StatusLocacao): string {
    const labels: Record<StatusLocacao, string> = {
      ATIVA: 'Ativa', DEVOLVIDA: 'Devolvida', ATRASADA: 'Atrasada', CANCELADA: 'Cancelada', ORCAMENTO: 'Orçamento' ,
    };
    return labels[status];
  }

  private hoje(): string {
    return new Date().toISOString().split('T')[0];
  }

  private diasAPartirDeHoje(dias: number): string {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString().split('T')[0];
  }
}
