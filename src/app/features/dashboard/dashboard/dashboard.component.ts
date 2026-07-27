import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule } from 'ng-apexcharts';
import { MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { DashboardService } from '../dashboard.service';
import {
  DashboardKpisResponse,
  GraficoItemResponse,
  GraficoMensal,
  EstoqueCriticoResponse,
  LocacaoEmCursoResponse,
  ProdutoRascunhoResponse,
} from '../models/dashboard.models';

type Periodo = 'mes' | 'trimestre' | 'semestre' | 'ano' | 'custom';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule, DatePickerComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private service = inject(DashboardService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

  loading = true;

  // Filtros
  periodoAtivo: Periodo = 'mes';
  inicio = '';
  fim    = '';

  periodos: { label: string; value: Periodo }[] = [
    { label: 'Este mês',  value: 'mes' },
    { label: 'Trimestre', value: 'trimestre' },
    { label: 'Semestre',  value: 'semestre' },
    { label: 'Este ano',  value: 'ano' },
    { label: 'Período Personalizado',   value: 'custom' },
  ];

  // Dados
  kpis: DashboardKpisResponse | null = null;
  graficoMensal: GraficoMensal[] = [];
  estoqueCritico: EstoqueCriticoResponse[] = [];
  locacoesEmCurso: LocacaoEmCursoResponse[] = [];
  rascunhos: ProdutoRascunhoResponse[] = [];

  // Paginação de "Locações em Curso"
  locacoesPage = 0;
  readonly locacoesPageSize = 4;

  get totalPaginasLocacoes(): number {
    return Math.max(1, Math.ceil(this.locacoesEmCurso.length / this.locacoesPageSize));
  }

  get locacoesEmCursoPagina(): LocacaoEmCursoResponse[] {
    const inicio = this.locacoesPage * this.locacoesPageSize;
    return this.locacoesEmCurso.slice(inicio, inicio + this.locacoesPageSize);
  }

  mudarPaginaLocacoes(delta: number): void {
    const nova = this.locacoesPage + delta;
    if (nova < 0 || nova >= this.totalPaginasLocacoes) return;
    this.locacoesPage = nova;
  }

  // Getters derivados
  get locacoesAtrasadas(): LocacaoEmCursoResponse[] {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return this.locacoesEmCurso.filter(l => {
      const dev = new Date(l.dataDevolucao + 'T00:00:00');
      return dev < hoje || l.status === 'ATRASADA';
    });
  }

  // ─── Sparklines ──────────────────────────────────────────────
  receitaSpark:  any = { series: [{ data: [] }], ...this.buildSpark('#0ea5e9') };
  locacoesSpark: any = { series: [{ data: [] }], ...this.buildSpark('#f59e0b') };
  vendasSpark:   any = { series: [{ data: [] }], ...this.buildSpark('#22c55e') };
  clientesSpark: any = { series: [{ data: [0, 0, 0, 0, 0, 0] }], ...this.buildSpark('#a855f7') };

  buildSpark(color: string): any {
    return {
      chart:  { type: 'line', sparkline: { enabled: true }, height: 56, fontFamily: 'inherit' },
      stroke: { curve: 'smooth', width: 2.5 },
      colors: [color],
      tooltip: { enabled: false },
    };
  }

  // ─── Bar chart ───────────────────────────────────────────────
  barSeries: any[] = [];
  barChart:       any = { type: 'bar', height: 250, toolbar: { show: false }, fontFamily: 'inherit' };
  barPlotOptions: any = { bar: { columnWidth: '55%', borderRadius: 3, borderRadiusApplication: 'end' } };
  barColors           = ['#3b82f6', '#f59e0b'];
  barDataLabels:  any = { enabled: false };
  barGrid:        any = { borderColor: '#f1f5f9', strokeDashArray: 4 };
  barXaxis:       any = { categories: [], axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: '#94a3b8', fontSize: '12px' } } };
  barYaxis:       any = { labels: { formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v), style: { colors: '#94a3b8', fontSize: '12px' } } };
  barTooltip:     any = { y: { formatter: (v: number) => `R$ ${v.toLocaleString('pt-BR')}` } };

  // ─── Donut chart (Locações: ativas vs atrasadas) ─────────────
  donutSeries:      number[]  = [];
  donutChart:       any = { type: 'donut', height: 180, fontFamily: 'inherit' };
  donutColors           = ['#3b82f6', '#f43f5e'];
  donutLabels           = ['Em dia', 'Atrasadas'];
  donutLegend:      any = { show: false };
  donutDataLabels:  any = { enabled: false };
  donutPlotOptions: any = { pie: { donut: { size: '72%' } } };
  donutStroke:      any = { width: 0 };
  donutTooltip:     any = { y: { formatter: (v: number) => `${v} locação(ões)` } };

  // ─── Lifecycle ───────────────────────────────────────────────
  ngOnInit(): void {
    const state = history.state?.toast;
    if (state) {
      setTimeout(() => this.messageService.add({ ...state, life: 3000 }), 100);
    }
    setTimeout(() => this.selectPeriodo('mes'));
  }

  loadData(): void {
    this.loading = true;
    const filtro = { inicio: this.inicio, fim: this.fim };

    forkJoin({
      kpis:     this.service.getKpis(filtro),
      grafico:  this.service.getGrafico(filtro),
      estoque:  this.service.getEstoqueCritico(),
      locacoes: this.service.getLocacoesEmCurso(),
      rascunhos: this.service.getRascunhos(),
    }).subscribe({
      next: (res) => {
        this.kpis = res.kpis;
        this.estoqueCritico = res.estoque;
        this.locacoesEmCurso = res.locacoes;
        this.locacoesPage = 0;
        this.rascunhos = res.rascunhos;

        // Agrupa com granularidade inteligente
        this.graficoMensal = this.agruparDados(res.grafico);
        this.atualizarGraficos();

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao carregar dashboard', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  selectPeriodo(p: Periodo): void {
    this.periodoAtivo = p;
    if (p !== 'custom') {
      this.aplicarPeriodo(p);
    }
  }

  aplicarFiltroCustom(): void {
    if (this.inicio && this.fim) this.loadData();
  }

  limparFiltro(): void {
    this.selectPeriodo('mes');
  }

  limparFiltroButtonClass(_: Periodo): Record<string, boolean> {
    return {
      'px-3 py-1.5 text-xs rounded-lg transition-colors font-medium': true,
      'text-red-500 hover:bg-red-50 border border-red-200': true,
    };
  }

  // ─── Helpers de período ──────────────────────────────────────
  private aplicarPeriodo(p: Periodo): void {
    const hoje = new Date();
    let start = new Date(hoje);
    if (p === 'mes') start = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    else if (p === 'trimestre') start.setMonth(hoje.getMonth() - 2);
    else if (p === 'semestre')  start.setMonth(hoje.getMonth() - 5);
    else if (p === 'ano')       start.setFullYear(hoje.getFullYear() - 1);
    this.inicio = start.toISOString().split('T')[0];
    this.fim    = hoje.toISOString().split('T')[0];
    this.loadData();
  }

  // ─── Agrupamento inteligente por período ─────────────────────
  private agruparDados(dados: GraficoItemResponse[]): GraficoMensal[] {
    const dias = this.diasNoPeriodo();

    if (dias <= 31) {
      // Mostra cada dia individualmente
      return dados.map(item => {
        const date = new Date(item.dia + 'T00:00:00');
        const label = date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit' });
        return { mes: label, vendas: Number(item.vendas), locacoes: Number(item.locacoes) };
      });
    }

    // Agrupa por mês para períodos maiores
    const mapa = new Map<string, { vendas: number; locacoes: number; order: number }>();

    for (const item of dados) {
      const date = new Date(item.dia + 'T00:00:00');
      const order = date.getFullYear() * 12 + date.getMonth();
      const label = date.toLocaleString('pt-BR', { month: 'short' })
        .replace('.', '')
        .replace(/^\w/, c => c.toUpperCase());

      const existing = mapa.get(label) ?? { vendas: 0, locacoes: 0, order };
      mapa.set(label, {
        vendas:   existing.vendas   + Number(item.vendas),
        locacoes: existing.locacoes + Number(item.locacoes),
        order,
      });
    }

    return Array.from(mapa.entries())
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([mes, v]) => ({ mes, vendas: v.vendas, locacoes: v.locacoes }));
  }

  private diasNoPeriodo(): number {
    const i = new Date(this.inicio);
    const f = new Date(this.fim);
    return Math.ceil((f.getTime() - i.getTime()) / (1000 * 60 * 60 * 24));
  }

  // ─── Atualiza gráficos com dados reais ───────────────────────
  private atualizarGraficos(): void {
    const vendasMensal  = this.graficoMensal.map(g => g.vendas);
    const locacoesMensal = this.graficoMensal.map(g => g.locacoes);
    const meses = this.graficoMensal.map(g => g.mes);

    // Sparklines
    this.receitaSpark  = { ...this.buildSpark('#0ea5e9'), series: [{ data: vendasMensal }] };
    this.vendasSpark   = { ...this.buildSpark('#22c55e'), series: [{ data: vendasMensal }] };
    this.locacoesSpark = { ...this.buildSpark('#f59e0b'), series: [{ data: locacoesMensal }] };

    // Bar chart
    this.barSeries = [
      { name: 'Vendas',   data: vendasMensal },
      { name: 'Locações', data: locacoesMensal },
    ];
    const isDiario = this.diasNoPeriodo() <= 31;
    this.barXaxis = {
      ...this.barXaxis,
      categories: meses,
      labels: {
        rotate: isDiario ? -45 : 0,
        rotateAlways: isDiario,
        style: { colors: '#94a3b8', fontSize: isDiario ? '10px' : '12px' },
      },
    };

    // Donut (locações em dia vs atrasadas)
    const atrasadas = this.locacoesAtrasadas.length;
    const emDia = Math.max((this.kpis?.locacoesAtivas ?? 0) - atrasadas, 0);
    this.donutSeries = [emDia, atrasadas];
  }

  // ─── Helpers de template ─────────────────────────────────────
  formatCurrency(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  estoquePercent(item: EstoqueCriticoResponse): number {
    return Math.min((item.quantidadeAtual / item.estoqueMinimo) * 100, 100);
  }

  estoqueBarColor(item: EstoqueCriticoResponse): string {
    const pct = this.estoquePercent(item);
    if (pct < 40) return 'bg-red-500';
    if (pct < 70) return 'bg-orange-400';
    return 'bg-yellow-400';
  }

  estoqueQtdColor(item: EstoqueCriticoResponse): Record<string, boolean> {
    return {
      'text-red-500':    this.estoquePercent(item) < 40,
      'text-orange-500': this.estoquePercent(item) >= 40,
    };
  }

  locacaoAtrasada(l: LocacaoEmCursoResponse): boolean {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dev  = new Date(l.dataDevolucao + 'T00:00:00');
    return dev < hoje || l.status === 'ATRASADA';
  }

  periodoButtonClass(value: Periodo): Record<string, boolean> {
    const active = this.periodoAtivo === value;
    return {
      'bg-blue-600 text-white font-semibold':        active,
      'text-gray-500 hover:bg-slate-100 font-medium': !active,
      'px-3 py-1.5 text-xs rounded-lg transition-colors': true,
    };
  }


  get locacoesEmDia(): number {
    return Math.max((this.kpis?.locacoesAtivas ?? 0) - this.locacoesAtrasadas.length, 0);
  }
}
