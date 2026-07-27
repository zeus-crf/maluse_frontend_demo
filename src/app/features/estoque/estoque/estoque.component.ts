import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import {
  NgApexchartsModule,
  ApexNonAxisChartSeries,
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexGrid,
  ApexLegend,
  ApexDataLabels,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexResponsive,
} from 'ng-apexcharts';

import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { TableColumn, TableActionConfig } from '../../../shared/components/data-table/data-table.models';
import { EstoqueService } from './estoque.service';
import { NovoProdutoModalComponent } from '../novo-produto-modal/novo-produto-modal.component';
import { EstoqueFiltrosModalComponent } from '../estoque-filtros-modal/estoque-filtros-modal.component';
import { ProdutoDetalheModalComponent } from '../produto-detalhe-modal/produto-detalhe-modal.component';
import {
  ProdutoResponse,
  ProdutoRequest,
  ProdutoAtualizarRequest,
  UnidadeMedida,
  TabFiltroEstoque,
  StatusEstoque,
  EstoqueFiltroCompleto,
  FILTRO_ESTOQUE_PADRAO,
} from '../models/estoque.models';

@Component({
  selector: 'app-estoque',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TooltipModule,
    InputTextModule,
    NgApexchartsModule,
    DataTableComponent,
    NovoProdutoModalComponent,
    EstoqueFiltrosModalComponent,
    ProdutoDetalheModalComponent,
  ],
  templateUrl: './estoque.component.html',
  styleUrl: './estoque.component.scss',
})
export class EstoqueComponent implements OnInit {

  private cdr            = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  private service        = inject(EstoqueService);

  // ── Estado ────────────────────────────────────────────────
  produtos: ProdutoResponse[] = [];
  rascunhos: ProdutoResponse[] = [];
  loading  = true;
  salvando = false;

  tabAtiva: TabFiltroEstoque = 'TODOS';

  filtro: EstoqueFiltroCompleto = { ...FILTRO_ESTOQUE_PADRAO };
  showModalFiltros = false;

  showModal   = false;
  produtoEdit: ProdutoResponse | null = null;

  showDetalhe    = false;
  produtoDetalhe: ProdutoResponse | null = null;

  // ── Labels ────────────────────────────────────────────────
  readonly medidaLabel: Record<UnidadeMedida, string> = {
    SACO: 'sc', METRO: 'm', METRO_QUADRADO: 'm²',
    LITRO: 'lt', PECA: 'un', KG: 'kg', ROLO: 'rl', BALDE: 'bd',
  };

  readonly tabs: { label: string; value: TabFiltroEstoque }[] = [
    { label: 'Todos',  value: 'TODOS'  },
    { label: 'OK',     value: 'OK'     },
    { label: 'Baixo',  value: 'BAIXO'  },
    { label: 'Zerado', value: 'ZERADO' },
  ];

  // ── Colunas ───────────────────────────────────────────────
  readonly colunasProdutos: TableColumn[] = [
    { field: 'nome', header: 'Produto', width: '20%' },
    {
      field: 'quantidadeEstoque', header: 'Qtd.', width: '8%',
      type: 'computed',
      valueFn: (row: ProdutoResponse) => String(row.quantidadeEstoque),
      cellClassFn: (row: ProdutoResponse) =>
        row.quantidadeEstoque < 0 ? 'text-red-500 font-semibold' : '',
    },
    {
      field: 'medida', header: 'Un.', width: '6%',
      type: 'computed',
      valueFn: (row: ProdutoResponse) => this.medidaLabel[row.medida],
    },
    { field: 'estoqueMinimo', header: 'Mínimo', width: '7%' },
    { field: 'valorCompra', header: 'Custo un.', width: '11%', type: 'currency' },
    { field: 'preco', header: 'Preço un.', width: '11%', type: 'currency' },
    {
      field: 'valorTotal', header: 'Custo total', width: '11%',
      type: 'computed',
      valueFn: (row: ProdutoResponse) =>
        (Number(row.valorCompra) * row.quantidadeEstoque)
          .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    },
    {
      field: 'lucroMaximo', header: 'Lucro máx.', width: '12%',
      type: 'computed',
      valueFn: (row: ProdutoResponse) =>
        ((Number(row.preco) - Number(row.valorCompra)) * row.quantidadeEstoque)
          .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      cellClassFn: (row: ProdutoResponse) =>
        (Number(row.preco) - Number(row.valorCompra)) * row.quantidadeEstoque < 0
          ? 'text-red-500 font-semibold'
          : '',
    },
    {
      field: 'estoqueBaixo', header: 'Status', width: '10%',
      type: 'tag',
      tagSeverityFn: (_: unknown, row: ProdutoResponse) => {
        if (row.quantidadeEstoque <= 0) return 'danger';
        if (row.estoqueBaixo)           return 'warn';
        return 'success';
      },
      tagLabelFn: (_: unknown, row: ProdutoResponse) => {
        if (row.quantidadeEstoque <= 0) return 'Zerado';
        if (row.estoqueBaixo)           return 'Baixo';
        return 'OK';
      },
    },
  ];

    readonly colunasRascunhos: TableColumn[] = [
    { field: 'nome',  header: 'Produto (a completar)', width: '60%' },
    { field: 'preco', header: 'Valor un.', width: '25%', type: 'currency' },
  ];

  readonly acoesRascunhos: TableActionConfig = {
    showView:   false,
    showEdit:   true,
    editIcon:   'pi pi-check-circle',
    editTooltip:'Completar cadastro',
    showDelete:        true,
    deleteIcon:        'pi pi-trash',
    deleteTooltip:     'Inativar',
    deleteHeader:      'Inativar rascunho',
    deleteAcceptLabel: 'Inativar',
    deleteMessageFn:   (p: ProdutoResponse) =>
      `Inativar o rascunho "${p.nome}"? Ele não aparecerá mais na lista de produtos a completar.`,
  };

  readonly acoesProdutos: TableActionConfig = {
    showView:   true,
    viewIcon:   'pi pi-eye',
    viewTooltip:'Visualizar',
    showEdit:   true,
    editIcon:   'pi pi-pencil',
    editTooltip:'Editar',
    showDelete: true,
    deleteIcon:          'pi pi-trash',
    deleteTooltip:       'Inativar',
    deleteHeader:        'Inativar produto',
    deleteAcceptLabel:   'Inativar',
    deleteMessageFn:     (p: ProdutoResponse) =>
      `Inativar "${p.nome}"? Ele não aparecerá mais no sistema.`,
  };

  // ── ApexCharts donut ──────────────────────────────────────
  donutSeries:      ApexNonAxisChartSeries = [0, 0, 0];
  donutChart:       ApexChart = {
    type: 'donut', height: 220,
    toolbar: { show: false }, fontFamily: 'inherit',
  };
  donutLabels:      string[]       = ['OK', 'Baixo', 'Zerado'];
  donutColors:      string[]       = ['#22c55e', '#f59e0b', '#ef4444'];
  donutLegend:      ApexLegend     = { position: 'bottom', fontSize: '12px' };
  donutDataLabels:  ApexDataLabels = { enabled: false };
  donutPlotOptions: ApexPlotOptions = {
    pie: {
      donut: {
        size: '68%',
        labels: {
          show: true,
          total: {
            show: true, label: 'Total', fontSize: '13px', color: '#64748b',
            formatter: (w: any) => String(w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0)),
          },
        },
      },
    },
  };
  donutStroke:     ApexStroke     = { width: 0 };
  donutTooltip:    ApexTooltip    = { y: { formatter: (v: number) => `${v} item(s)` } };
  donutResponsive: ApexResponsive[] = [{ breakpoint: 480, options: { chart: { height: 200 } } }];

  // ── ApexCharts bar ────────────────────────────────────────
  barSeries:      ApexAxisChartSeries = [{ name: 'Quantidade', data: [] }];
  barChart:       ApexChart = {
    type: 'bar', height: 220,
    toolbar: { show: false }, fontFamily: 'inherit',
  };
  barXAxis:       ApexXAxis       = { categories: [], labels: { style: { fontSize: '11px', colors: '#94a3b8' }, rotate: -30 } };
  barYAxis:       ApexYAxis       = { labels: { style: { fontSize: '11px', colors: ['#94a3b8'] } } };
  barGrid:        ApexGrid        = { borderColor: '#f1f5f9', strokeDashArray: 4 };
  barDataLabels:  ApexDataLabels  = { enabled: false };
  barPlotOptions: ApexPlotOptions = { bar: { borderRadius: 4, columnWidth: '55%', distributed: true } };
  barLegend:      ApexLegend      = { show: false };
  barColors:      string[]        = [];
  barTooltip:     ApexTooltip     = { y: { formatter: (v: number, opts: any) => {
    const medida = this._barMedidas[opts.dataPointIndex] ?? '';
    return `${v} ${medida}`;
  }}};
  _barMedidas: string[] = [];

  get mostrarBarChart(): boolean { return this.produtos.length >= 5; }

  // ── KPIs ─────────────────────────────────────────────────
  get valorTotalEstoque(): number {
    // Rascunhos (produtos ainda não concluídos) não entram no valor em estoque
    return this.produtos
      .filter(p => !p.rascunho)
      .reduce((acc, p) => acc + Number(p.valorCompra) * p.quantidadeEstoque, 0);
  }

  get totalBaixo(): number {
    return this.produtos.filter(p => this.statusDe(p) === 'BAIXO').length;
  }

  get totalZerado(): number {
    return this.produtos.filter(p => this.statusDe(p) === 'ZERADO').length;
  }

  // ── Filtro ────────────────────────────────────────────────
  get produtosFiltrados(): ProdutoResponse[] {
    return this.produtos.filter(p => {
      const matchTab    = this.tabAtiva === 'TODOS' || this.statusDe(p) === this.tabAtiva;
      const matchMedida = this.filtro.medida === 'TODOS' || p.medida === this.filtro.medida;
      const preco       = Number(p.preco);
      const matchMinP   = this.filtro.minPreco === null || preco >= this.filtro.minPreco;
      const matchMaxP   = this.filtro.maxPreco === null || preco <= this.filtro.maxPreco;
      const matchMinQ   = this.filtro.minQtd   === null || p.quantidadeEstoque >= this.filtro.minQtd;
      const matchMaxQ   = this.filtro.maxQtd   === null || p.quantidadeEstoque <= this.filtro.maxQtd;
      return matchTab && matchMedida && matchMinP && matchMaxP && matchMinQ && matchMaxQ;
    });
  }

  get temFiltroAtivo(): boolean {
    return this.filtro.medida   !== 'TODOS' ||
           this.filtro.minPreco !== null    ||
           this.filtro.maxPreco !== null    ||
           this.filtro.minQtd   !== null    ||
           this.filtro.maxQtd   !== null;
  }

  get contadorFiltros(): number {
    let n = 0;
    if (this.filtro.medida   !== 'TODOS') n++;
    if (this.filtro.minPreco !== null)    n++;
    if (this.filtro.maxPreco !== null)    n++;
    if (this.filtro.minQtd   !== null)    n++;
    if (this.filtro.maxQtd   !== null)    n++;
    return n;
  }

  onAplicarFiltro(f: EstoqueFiltroCompleto): void {
    this.filtro     = f;
    this.showModalFiltros = false;
  }

  onLimparFiltro(): void {
    this.filtro     = { ...FILTRO_ESTOQUE_PADRAO };
    this.showModalFiltros = false;
  }

  get countPorTab(): Record<TabFiltroEstoque, number> {
    return {
      TODOS:  this.produtos.length,
      OK:     this.produtos.filter(p => this.statusDe(p) === 'OK').length,
      BAIXO:  this.totalBaixo,
      ZERADO: this.totalZerado,
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────
  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.loading = true;
    this.service.getProdutos().subscribe({
      next: data => {
        this.produtos = data;
        this.carregarRascunhos();
        this.recalcularGrafico();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loading = false;
        const detail = err?.error?.message ?? 'Não foi possível carregar os produtos.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
      },
    });
  }

carregarRascunhos(): void {
    this.service.getRascunhos().subscribe({
      next: data => { this.rascunhos = data; this.cdr.detectChanges(); },
      error: (err : any) => { 
        const detail = err?.error?.message ?? 'Não foi possível carregar os produtos rascunho.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
      },
    });
  }
  // ── Modal ─────────────────────────────────────────────────
  abrirModalNovo(): void {
    this.produtoEdit = null;
    this.showModal   = true;
  }

  abrirModalEditar(produto: ProdutoResponse): void {
    this.produtoEdit = produto;
    this.showModal   = true;
  }

  fecharModal(): void {
    this.showModal   = false;
    this.produtoEdit = null;
  }

  // ── Modal Detalhe ─────────────────────────────────────────
  abrirDetalhe(produto: ProdutoResponse): void {
    this.produtoDetalhe = produto;
    this.showDetalhe    = true;
  }

  fecharDetalhe(): void {
    this.showDetalhe    = false;
    this.produtoDetalhe = null;
  }

  onEditarDoDetalhe(produto: ProdutoResponse): void {
    this.fecharDetalhe();
    this.abrirModalEditar(produto);
  }


    // ── Modal Filtros ──────────────────────────────────────────
  abrirModalFiltros(): void  { this.showModalFiltros = true; }
  fecharModalFiltros(): void { this.showModalFiltros = false; }
  
  onAplicarFiltros(filtros: EstoqueFiltroCompleto): void {
    this.filtro = filtros;
    this.showModalFiltros = false;
  }

 
  
  onLimparFiltros(): void {
    this.filtro = { medida: 'TODOS', maxQtd: null,  minQtd: null, maxPreco: null, minPreco: null,};
    this.showModalFiltros = false;
  }

  onSalvar(payload: ProdutoRequest | ProdutoAtualizarRequest): void {
    this.salvando = true;
    if (this.produtoEdit) {
      this.service.atualizar(this.produtoEdit.id, payload as ProdutoAtualizarRequest).subscribe({
         next: updated => {
          // Substitui no lugar preservando a ordem; se veio de um rascunho recém-completado,
          // ainda não está em `produtos`, então acrescenta.
          this.produtos = this.produtos.some(p => p.id === updated.id)
            ? this.produtos.map(p => p.id === updated.id ? updated : p)
            : [...this.produtos, updated];
          this.rascunhos  = this.rascunhos.filter(r => r.id !== updated.id);
          this.recalcularGrafico();
          this.fecharModal();
          this.salvando = false;
          this.messageService.add({ severity: 'success', summary: 'Salvo', detail: 'Produto atualizado.' });
        },
        error: (err: any) => {
          this.salvando = false;
          const detail = err?.error?.message ?? 'Não foi possível salvar.';
          this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
        },
      });
    } else {
      this.service.criar(payload as ProdutoRequest).subscribe({
        next: novo => {
          this.produtos = [...this.produtos, novo];
          this.recalcularGrafico();
          this.fecharModal();
          this.salvando = false;
          this.messageService.add({ severity: 'success', summary: 'Criado', detail: 'Produto adicionado ao estoque.' });
        },
        error: (err: any) => {
          this.salvando = false;
          const detail = err?.error?.message ?? 'Não foi possível criar o produto.';
          this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
        },
      });
    }
  }

  onInativar(produto: ProdutoResponse): void {
    this.service.inativar(produto.id).subscribe({
      next: () => {
        this.produtos = this.produtos.filter(p => p.id !== produto.id);
        this.recalcularGrafico();
        this.messageService.add({ severity: 'info', summary: 'Inativado', detail: `"${produto.nome}" foi inativado.` });
      },
      error: (err: any) => {
        const detail = err?.error?.message ?? 'Não foi possível inativar.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
      },
    });
  }

    abrirModalCompletar(rascunho: ProdutoResponse): void {
    this.produtoEdit = rascunho;   // reutiliza o fluxo de edição existente
    this.showModal   = true;
  }

  onInativarRascunho(rascunho: ProdutoResponse): void {
    this.service.inativar(rascunho.id).subscribe({
      next: () => {
        this.rascunhos = this.rascunhos.filter(r => r.id !== rascunho.id);
        this.messageService.add({ severity: 'info', summary: 'Inativado', detail: `Rascunho "${rascunho.nome}" foi inativado.` });
      },
      error: (err: any) => {
        const detail = err?.error?.message ?? 'Não foi possível inativar o rascunho.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  statusDe(p: ProdutoResponse): StatusEstoque {
    if (p.quantidadeEstoque <= 0) return 'ZERADO';
    if (p.estoqueBaixo)           return 'BAIXO';
    return 'OK';
  }

  private recalcularGrafico(): void {
    // Donut
    const ok     = this.produtos.filter(p => this.statusDe(p) === 'OK').length;
    const baixo  = this.totalBaixo;
    const zerado = this.totalZerado;
    this.donutSeries = [ok, baixo, zerado];

    // Bar — top 10 por quantidade
    const top = [...this.produtos]
      .sort((a, b) => b.quantidadeEstoque - a.quantidadeEstoque)
      .slice(0, 10);

    this.barSeries      = [{ name: 'Quantidade', data: top.map(p => p.quantidadeEstoque) }];
    this.barXAxis       = { ...this.barXAxis, categories: top.map(p => p.nome.length > 12 ? p.nome.slice(0, 12) + '…' : p.nome) };
    this._barMedidas    = top.map(p => this.medidaLabel[p.medida]);
    this.barColors      = top.map(p => {
      const s = this.statusDe(p);
      if (s === 'ZERADO') return '#ef4444';
      if (s === 'BAIXO')  return '#f59e0b';
      return '#22c55e';
    });

    this.cdr.detectChanges();
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

}
