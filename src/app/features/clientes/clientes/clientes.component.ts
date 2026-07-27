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
import { ClientesService } from './clientes.service';
import {
  ClienteResponse,
  ClienteRequest,
  ClienteAtualizarRequest,
  TabFiltroCliente,
  ClienteFiltroCompleto,
  FILTRO_CLIENTE_PADRAO,
} from '../models/clientes.models';
import { NovoClienteModalComponent } from "../components/novo-cliente-modal/novo-cliente-modal.component";
import { ClienteDetalheModalComponent } from '../components/cliente-detalhe-modal/cliente-detalhe-modal.component';
import { ClienteHistoricoModalComponent } from '../components/cliente-historico-modal/cliente-historico-modal.component';
import { ClientesFiltrosModalComponent } from '../components/clientes-filtros-modal/clientes-filtros-modal.component';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TooltipModule,
    InputTextModule,
    NgApexchartsModule,
    DataTableComponent,
    NovoClienteModalComponent,
    ClienteDetalheModalComponent,
    ClienteHistoricoModalComponent,
    ClientesFiltrosModalComponent,

  ],
  templateUrl: './clientes.component.html',
  styleUrl: './clientes.component.scss',
})
export class ClientesComponent implements OnInit {

  private cdr            = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  private service        = inject(ClientesService);

  // ── Estado ────────────────────────────────────────────────
  clientes: ClienteResponse[] = [];
  loading  = true;
  salvando = false;

  tabAtiva: TabFiltroCliente = 'TODOS';

  filtro: ClienteFiltroCompleto = { ...FILTRO_CLIENTE_PADRAO };
  showModalFiltros = false;

  showModal          = false;
  showModalDetalhe   = false;
  showModalHistorico = false;
  clienteEdit: ClienteResponse | null = null;
  clienteSelecionado: ClienteResponse | null = null;

  // ── Tabs ──────────────────────────────────────────────────
  readonly tabs: { label: string; value: TabFiltroCliente }[] = [
    { label: 'Todos', value: 'TODOS' },
    { label: 'PF',    value: 'PF'    },
    { label: 'PJ',    value: 'PJ'    },
  ];

  // ── Colunas ───────────────────────────────────────────────
  readonly colunasClientes: TableColumn[] = [
    { field: 'nome',     header: 'Nome',      width: '28%' },
    { field: 'cpfCnpj',  header: 'CPF/CNPJ',  width: '16%' },
    { field: 'telefone', header: 'Telefone',   width: '14%' },
    { field: 'email',    header: 'E-mail',     width: '22%' },
    { field: 'endereco', header: 'Endereço',   width: '14%' },
    {
      field: 'consumidorFinal', header: 'Tipo', width: '10%',
      type: 'tag',
      tagSeverityFn: (_: unknown, row: ClienteResponse) =>
        row.consumidorFinal ? 'success' : 'secondary',
      tagLabelFn: (_: unknown, row: ClienteResponse) =>
        row.consumidorFinal ? 'PF' : 'PJ',
    },
  ];

  readonly acoesClientes: TableActionConfig = {
    showView:        true,
    viewIcon:        'pi pi-eye',
    viewTooltip:     'Detalhes',
    showEdit:        true,
    editIcon:        'pi pi-pencil',
    editTooltip:     'Editar',
    showDelete:      true,
    deleteIcon:          'pi pi-trash',
    deleteTooltip:       'Inativar',
    deleteHeader:        'Inativar cliente',
    deleteAcceptLabel:   'Inativar',
    deleteMessageFn:     (c: ClienteResponse) =>
      `Inativar "${c.nome}"? Ele não aparecerá mais no sistema.`,
  };

  // ── ApexCharts donut ──────────────────────────────────────
  donutSeries:      ApexNonAxisChartSeries = [0, 0];
  donutChart:       ApexChart = {
    type: 'donut', height: 220,
    toolbar: { show: false }, fontFamily: 'inherit',
  };
  donutLabels:      string[]       = ['Pessoa Física', 'Pessoa Jurídica'];
  donutColors:      string[]       = ['#3b82f6', '#8b5cf6'];
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
            formatter: (w: any) =>
              String(w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0)),
          },
        },
      },
    },
  };
  donutStroke:     ApexStroke      = { width: 0 };
  donutTooltip:    ApexTooltip     = { y: { formatter: (v: number) => `${v} cliente(s)` } };
  donutResponsive: ApexResponsive[] = [{ breakpoint: 480, options: { chart: { height: 200 } } }];

  // ── ApexCharts bar ────────────────────────────────────────
  barSeries:      ApexAxisChartSeries = [{ name: 'Total gasto', data: [] }];
  barChart:       ApexChart = {
    type: 'bar', height: 220,
    toolbar: { show: false }, fontFamily: 'inherit',
  };
  barXAxis:       ApexXAxis      = { categories: [], labels: { style: { fontSize: '11px', colors: '#94a3b8' }, rotate: -30 } };
  barYAxis:       ApexYAxis      = { labels: { style: { fontSize: '11px', colors: ['#94a3b8'] }, formatter: (v: number) => `R$ ${v.toLocaleString('pt-BR')}` } };
  barGrid:        ApexGrid       = { borderColor: '#f1f5f9', strokeDashArray: 4 };
  barDataLabels:  ApexDataLabels = { enabled: false };
  barPlotOptions: ApexPlotOptions = { bar: { borderRadius: 4, columnWidth: '55%', distributed: true } };
  barLegend:      ApexLegend     = { show: false };
  barColors:      string[]       = [];
  barTooltip:     ApexTooltip    = { y: { formatter: (v: number) => this.formatCurrency(v) } };

  get mostrarBarChart(): boolean {
    return this.clientes.length >= 2;
  }

  // ── KPIs ─────────────────────────────────────────────────
  get totalPF(): number {
    return this.clientes.filter(c => c.consumidorFinal).length;
  }

  get totalPJ(): number {
    return this.clientes.filter(c => !c.consumidorFinal).length;
  }

  get totalAtivos(): number {
    return this.clientes.filter(c => c.ativo).length;
  }

  // ── Helpers de tipo ───────────────────────────────────────
  tipoDe(c: ClienteResponse): 'PF' | 'PJ' {
    return c.consumidorFinal ? 'PF' : 'PJ';
  }

  // ── Filtros ───────────────────────────────────────────────
  get clientesFiltrados(): ClienteResponse[] {
    return this.clientes.filter(c => {
      const matchTab  = this.tabAtiva === 'TODOS' || this.tipoDe(c) === this.tabAtiva;
      const matchTipo = this.filtro.tipoCliente === 'TODOS' || this.tipoDe(c) === this.filtro.tipoCliente;
      return matchTab && matchTipo;
    });
  }

  get temFiltroAtivo(): boolean {
    return this.filtro.tipoCliente !== 'TODOS'  ||
           this.filtro.dataInicial !== null     ||
           this.filtro.dataFinal   !== null     ||
           this.filtro.minCompras  !== null     ||
           this.filtro.maxCompras  !== null;
  }

  get contadorFiltros(): number {
    let n = 0;
    if (this.filtro.tipoCliente !== 'TODOS') n++;
    if (this.filtro.dataInicial !== null)    n++;
    if (this.filtro.dataFinal   !== null)    n++;
    if (this.filtro.minCompras  !== null)    n++;
    if (this.filtro.maxCompras  !== null)    n++;
    return n;
  }

  get countPorTab(): Record<TabFiltroCliente, number> {
    return {
      TODOS: this.clientes.length,
      PF:    this.totalPF,
      PJ:    this.totalPJ,
    };
  }

  onAplicarFiltros(f: ClienteFiltroCompleto): void {
    this.filtro          = f;
    this.showModalFiltros = false;
  }

  onLimparFiltros(): void {
    this.filtro          = { ...FILTRO_CLIENTE_PADRAO };
    this.showModalFiltros = false;
  }

  // ── Lifecycle ─────────────────────────────────────────────
  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.loading = true;
    this.service.getClientes().subscribe({
      next: data => {
        this.clientes = data;
        this.recalcularGrafico();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loading = false;
        const detail = err?.error?.message ?? 'Não foi possível carregar os clientes.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
      },
    });
  }

  // ── Modal Novo/Editar ─────────────────────────────────────
  abrirModalNovo(): void {
    this.clienteEdit = null;
    this.showModal   = true;
  }

  abrirModalEditar(cliente: ClienteResponse): void {
    this.showModalDetalhe = false;
    this.clienteEdit      = cliente;
    this.showModal        = true;
  }

  fecharModal(): void {
    this.showModal   = false;
    this.clienteEdit = null;
  }

  // ── Modal Detalhe ─────────────────────────────────────────
  abrirDetalhe(cliente: ClienteResponse): void {
    this.clienteSelecionado  = cliente;
    this.showModalDetalhe    = true;
  }

  fecharDetalhe(): void {
    this.showModalDetalhe   = false;
    this.clienteSelecionado = null;
  }

  abrirHistorico(cliente: ClienteResponse): void {
    this.showModalHistorico = true;
  }

  fecharHistorico(): void {
    this.showModalHistorico = false;
  }

  onSalvar(payload: ClienteRequest | ClienteAtualizarRequest): void {
    this.salvando = true;
    if (this.clienteEdit) {
      this.service.atualizar(this.clienteEdit.id, payload as ClienteAtualizarRequest).subscribe({
        next: updated => {
          this.clientes = this.clientes.map(c => c.id === updated.id ? updated : c);
          this.recalcularGrafico();
          this.fecharModal();
          this.salvando = false;
          this.messageService.add({ severity: 'success', summary: 'Salvo', detail: 'Cliente atualizado.' });
        },
        error: (err: any) => {
          this.salvando = false;
          const detail = err?.error?.message ?? 'Não foi possível salvar.';
          this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
        },
      });
    } else {
      this.service.criar(payload as ClienteRequest).subscribe({
        next: novo => {
          this.clientes = [...this.clientes, novo];
          this.recalcularGrafico();
          this.fecharModal();
          this.salvando = false;
          this.messageService.add({ severity: 'success', summary: 'Criado', detail: 'Cliente cadastrado.' });
        },
        error: (err: any) => {
          this.salvando = false;
          const detail = err?.error?.message ?? 'Não foi possível cadastrar.';
          this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
        },
      });
    }
  }

  onInativar(cliente: ClienteResponse): void {
    this.service.inativar(cliente.id).subscribe({
      next: () => {
        this.clientes = this.clientes.filter(c => c.id !== cliente.id);
        this.recalcularGrafico();
        this.messageService.add({
          severity: 'info', summary: 'Inativado',
          detail: `"${cliente.nome}" foi inativado.`,
        });
      },
      error: (err: any) => {
        const detail = err?.error?.message ?? 'Não foi possível inativar.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
      },
    });
  }

  // ── Grafico ───────────────────────────────────────────────
  private recalcularGrafico(): void {
    // Donut PF vs PJ
    this.donutSeries = [this.totalPF, this.totalPJ];

    // Bar — top 8 por totalGasto (inclui todos, mesmo com R$0)
    const top = [...this.clientes]
      .sort((a, b) => Number(b.totalGasto) - Number(a.totalGasto))
      .slice(0, 8);

    const palette = ['#3b82f6', '#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#93c5fd', '#60a5fa', '#818cf8'];
    this.barSeries  = [{ name: 'Total gasto', data: top.map(c => Number(c.totalGasto)) }];
    this.barXAxis   = { ...this.barXAxis, categories: top.map(c => c.nome.length > 12 ? c.nome.slice(0, 12) + '…' : c.nome) };
    this.barColors  = top.map((_, i) => palette[i] ?? '#8b5cf6');

    this.cdr.detectChanges();
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
