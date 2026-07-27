import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';

import { RelatoriosService } from './relatorios.service';
import {
  KpisResponse,
  ReceitaMensalItemResponse,
  StatusFinanceiroResponse,
  TopClienteResponse,
  TopProdutoResponse,
} from '../models/relatorios.models';

@Component({
  selector: 'app-relatorios',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './relatorios.component.html',
  styleUrl: './relatorios.component.scss',
})
export class RelatoriosComponent implements OnInit {
  private service = inject(RelatoriosService);
  private cdr     = inject(ChangeDetectorRef);

  periodo: '3m' | '6m' | '12m' = '6m';
  carregando = false;
  paginaTopProdutos = 0;
  readonly itensPorPagina = 6;

  kpis: KpisResponse | null = null;
  receitaMensal: ReceitaMensalItemResponse[] = [];
  statusFinanceiro: StatusFinanceiroResponse | null = null;
  topClientes: TopClienteResponse[] = [];
  topProdutos: TopProdutoResponse[] = [];

  chartReceita: any = {};
  chartMargem: any = {};
  chartStatusFinanceiro: any = {};

  readonly periodos = [
    { label: '3 meses', value: '3m' as const },
    { label: '6 meses', value: '6m' as const },
    { label: '12 meses', value: '12m' as const },
  ];

  readonly kpiCards = [
    { key: 'receita',      label: 'Receita total',     icon: 'trending_up',     varKey: 'variacaoReceita',    cor: 'text-green-600',   bgIcon: 'bg-green-50',   tooltip: 'Tudo que entrou: soma de todas as vendas e locações confirmadas no período, incluindo pagamentos à vista e fiado.' },
    { key: 'cmv',          label: 'Custo de Produtos', icon: 'inventory_2',     varKey: '',                   cor: 'text-orange-500',  bgIcon: 'bg-orange-50',  tooltip: 'Quanto custou o que você vendeu. Calculado pelo valor de compra × quantidade de cada produto. Quanto menor em relação à receita, maior sua margem.' },
    { key: 'despesas',     label: 'Despesas',          icon: 'trending_down',   varKey: 'variacaoDespesas',   cor: 'text-red-500',     bgIcon: 'bg-red-50',     tooltip: 'Gastos do negócio registrados no financeiro: aluguel, energia, salários, etc. Não inclui custo de produtos — isso fica no CMV acima.' },
    { key: 'lucroLiquido', label: 'Lucro líquido',     icon: 'show_chart',      varKey: '',                   cor: 'text-emerald-600', bgIcon: 'bg-emerald-50', tooltip: 'O que sobrou de verdade: Receita − CMV − Despesas. É o indicador mais completo da saúde do negócio no período.' },
    { key: 'saldo',        label: 'Saldo financeiro',  icon: 'account_balance', varKey: 'variacaoSaldo',      cor: 'text-blue-600',    bgIcon: 'bg-blue-50',    tooltip: 'Fluxo de caixa do período: Receita − Despesas, sem descontar o custo dos produtos. Indica se o dinheiro em conta cobre os gastos operacionais.' },
    { key: 'ticketMedio',  label: 'Ticket médio',      icon: 'receipt_long',    varKey: 'variacaoTicketMedio',cor: 'text-purple-600',  bgIcon: 'bg-purple-50',  tooltip: 'Valor médio por pedido (Receita ÷ pedidos confirmados). Aumentar o ticket é uma forma de crescer sem precisar de mais clientes.' },
  ];

  ngOnInit(): void {
    this.carregar();
  }

  setPeriodo(p: '3m' | '6m' | '12m'): void {
    this.periodo = p;
    this.carregar();
  }

  carregar(): void {
    this.paginaTopProdutos = 0;
    this.carregando = true;
    this.cdr.detectChanges();

    const meses = this.periodo === '3m' ? 3 : this.periodo === '12m' ? 12 : 6;
    let pendentes = 5;

    const onComplete = () => {
      pendentes--;
      if (pendentes === 0) {
        this.carregando = false;
        try { this.buildCharts(); } catch (e) { console.error('buildCharts error:', e); }
        this.cdr.detectChanges();
      }
    };

    this.service.kpis(this.periodo).subscribe({
      next: (d) => { this.kpis = d; onComplete(); },
      error: (e) => { console.error('kpis error', e); onComplete(); },
    });

    this.service.receitaMensal(meses).subscribe({
      next: (d) => { this.receitaMensal = d; onComplete(); },
      error: (e) => { console.error('receitaMensal error', e); onComplete(); },
    });

    this.service.statusFinanceiro().subscribe({
      next: (d) => { this.statusFinanceiro = d; onComplete(); },
      error: (e) => { console.error('statusFinanceiro error', e); onComplete(); },
    });

    this.service.topClientes(5, this.periodo).subscribe({
      next: (d) => { this.topClientes = d; onComplete(); },
      error: (e) => { console.error('topClientes error', e); onComplete(); },
    });

    this.service.topProdutos(100, this.periodo).subscribe({
      next: (d) => { this.topProdutos = d; onComplete(); },
      error: (e) => { console.error('topProdutos error', e); onComplete(); },
    });
  }

  private buildCharts(): void {
    const meses    = this.receitaMensal.map(r => this.formatMes(r.mes));
    const vendas   = this.receitaMensal.map(r => r.vendas);
    const locacoes = this.receitaMensal.map(r => r.locacoes);
    const despesas = this.receitaMensal.map(r => r.despesas);
    const cmv      = this.receitaMensal.map(r => r.cmv);
    const receitas = this.receitaMensal.map(r => r.vendas + r.locacoes);

    const baseChart = {
      toolbar: { show: false },
      fontFamily: 'inherit',
      zoom: { enabled: false },
    };

    const baseXAxis = {
      categories: meses,
      labels: { style: { fontSize: '11px', colors: '#94a3b8' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    };

    const baseYAxis = {
      labels: {
        style: { fontSize: '11px', colors: '#94a3b8' },
        formatter: (v: number) => 'R$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v),
      },
    };

    const baseGrid = { borderColor: '#f1f5f9', strokeDashArray: 4 };

    this.chartReceita = {
      series: [
        { name: 'Vendas',   data: vendas   },
        { name: 'Locações', data: locacoes },
      ],
      chart: { ...baseChart, type: 'area', height: 220 },
      colors: ['#3B82F6', '#10B981'],
      stroke: { curve: 'smooth', width: 2 },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.15, opacityTo: 0, stops: [0, 100] } },
      xaxis: baseXAxis,
      yaxis: baseYAxis,
      grid: baseGrid,
      dataLabels: { enabled: false },
      legend: { position: 'top', horizontalAlign: 'right', fontSize: '12px' },
      tooltip: { y: { formatter: (v: number) => this.formatCurrency(v) } },
    };

    this.chartMargem = {
      series: [
        { name: 'Receita',  data: receitas },
        { name: 'CMV',      data: cmv      },
        { name: 'Despesas', data: despesas },
      ],
      chart: { ...baseChart, type: 'area', height: 220 },
      colors: ['#3B82F6', '#F97316', '#EF4444'],
      stroke: { curve: 'smooth', width: [2, 2, 2], dashArray: [0, 4, 5] },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.1, opacityTo: 0, stops: [0, 100] } },
      xaxis: baseXAxis,
      yaxis: baseYAxis,
      grid: baseGrid,
      dataLabels: { enabled: false },
      legend: { position: 'top', horizontalAlign: 'right', fontSize: '12px' },
      tooltip: { y: { formatter: (v: number) => this.formatCurrency(v) } },
    };

    if (this.statusFinanceiro) {
      const sf = this.statusFinanceiro;
      this.chartStatusFinanceiro = {
        series: [sf.pagos, sf.pendentes, sf.vencidos],
        chart: { type: 'donut', height: 160, sparkline: { enabled: false } },
        labels: ['Pagos', 'Pendentes', 'Vencidos'],
        colors: ['#22C55E', '#F59E0B', '#EF4444'],
        legend: { show: false },
        dataLabels: { enabled: false },
        plotOptions: { pie: { donut: { size: '68%', labels: { show: true, total: { show: true, label: 'Total', fontSize: '11px', color: '#94a3b8',
          formatter: () => String(sf.pagos + sf.pendentes + sf.vencidos) } } } } },
        stroke: { width: 0 },
        tooltip: { y: { formatter: (v: number) => v + ' lançamentos' } },
      };
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0);
  }

  formatPercent(value: number | null): string {
    if (value === null || value === undefined) return '—';
    const sign = value >= 0 ? '↑' : '↓';
    return `${sign} ${Math.abs(value).toFixed(1)}%`;
  }

  isPositive(value: number | null): boolean {
    return value !== null && value !== undefined && value >= 0;
  }

  iniciais(nome: string): string {
    return nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  get topProdutosPaginados(): TopProdutoResponse[] {
    const inicio = this.paginaTopProdutos * this.itensPorPagina;
    return this.topProdutos.slice(inicio, inicio + this.itensPorPagina);
  }

  get totalPaginasTopProdutos(): number {
    return Math.ceil(this.topProdutos.length / this.itensPorPagina);
  }

  get maxTopProduto(): number {
    const paginados = this.topProdutosPaginados;
    return paginados.length > 0 ? paginados[0].lucro : 1;
  }

  get totalStatusFinanceiro(): number {
    if (!this.statusFinanceiro) return 0;
    return this.statusFinanceiro.pagos + this.statusFinanceiro.pendentes + this.statusFinanceiro.vencidos;
  }

  private formatMes(mes: string): string {
    const [ano, m] = mes.split('-');
    const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${nomes[parseInt(m) - 1]}/${ano.slice(2)}`;
  }

  readonly avatarCores = [
    'bg-teal-100 text-teal-700',
    'bg-blue-100 text-blue-700',
    'bg-amber-100 text-amber-700',
    'bg-purple-100 text-purple-700',
    'bg-pink-100 text-pink-700',
  ];
}
