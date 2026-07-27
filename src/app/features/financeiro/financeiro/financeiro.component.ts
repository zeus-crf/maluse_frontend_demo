import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { NgApexchartsModule } from 'ng-apexcharts';

import { FinanceiroService } from './financeiro.service';
import { ClientesService } from '../../clientes/clientes/clientes.service';
import { ClienteSimples } from '../../vendas/models/vendas.models';
import { NovoLancamentoModalComponent } from '../components/novo-lancamento-modal/novo-lancamento-modal.component';
import { LancamentoDetalheModalComponent } from '../components/lancamento-detalhe-modal/lancamento-detalhe-modal.component';
import { LancamentoEdicaoModalComponent } from '../components/lancamento-edicao-modal/lancamento-edicao-modal.component';
import { FinanceiroFiltrosModalComponent } from '../components/financeiro-filtros-modal/financeiro-filtros-modal.component';
import {
  LancamentoFinanceiroResponse,
  LancamentoFinanceiroRequest,
  LancamentoAtualizarRequest,
  ResumoMesResponse,
  TabFiltroFinanceiro,
  PeriodoGrafico,
  FinanceiroFiltro,
  FILTRO_FINANCEIRO_PADRAO,
  StatusLancamento,
} from '../models/financeiro.models';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { TableColumn, TableActionConfig } from '../../../shared/components/data-table/data-table.models';
import { SelectComponent } from '../../../shared/components/select/select.component';

@Component({
  selector: 'app-financeiro',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgApexchartsModule,
    DataTableComponent,
    NovoLancamentoModalComponent,
    LancamentoDetalheModalComponent,
    LancamentoEdicaoModalComponent,
    FinanceiroFiltrosModalComponent,
    SelectComponent,
  ],
  templateUrl: './financeiro.component.html',
  styleUrl: './financeiro.component.scss',
})
export class FinanceiroComponent implements OnInit {
  private service        = inject(FinanceiroService);
  private clientesService = inject(ClientesService);

  readonly opcoesStatus = [
    { value: 'TODOS',     label: 'Todos os status' },
    { value: 'PENDENTE',  label: 'Pendente'  },
    { value: 'PAGO',      label: 'Pago'      },
    { value: 'VENCIDO',   label: 'Vencido'   },
    { value: 'CANCELADO', label: 'Cancelado' },
  ];

  readonly opcoesOrdenacao = [
    { value: 'recente', label: 'Mais recentes' },
    { value: 'antigo',  label: 'Mais antigos'  },
  ];
  private cdr             = inject(ChangeDetectorRef);
  private messageService  = inject(MessageService);

  // ── Dados ──────────────────────────────────────────────────
  lancamentos: LancamentoFinanceiroResponse[] = [];
  clientes:    ClienteSimples[] = [];

  // ── Loading ────────────────────────────────────────────────
  loading  = true;
  salvando = false;

  // ── Filtros ────────────────────────────────────────────────
  filtro: FinanceiroFiltro = { ...FILTRO_FINANCEIRO_PADRAO };

  // ── Modais ─────────────────────────────────────────────────
  showModalCriar    = false;
  showModalDetalhe  = false;
  showModalEdicao   = false;
  showModalFiltros  = false;
  lancamentoSelecionado: LancamentoFinanceiroResponse | null = null;
  ordenacao: 'recente' | 'antigo' = 'recente';

  // ── Gráfico Fluxo de Caixa ────────────────────────────────
  periodoGrafico: PeriodoGrafico = '6M';

  readonly periodos: { label: string; value: PeriodoGrafico }[] = [
    { label: '3M', value: '3M' },
    { label: '6M', value: '6M' },
    { label: '12M', value: '12M' },
  ];

  areaChart:      any = { type: 'area', height: 200, toolbar: { show: false }, fontFamily: 'inherit' };
  areaStroke:     any = { curve: 'smooth', width: 2 };
  areaColors          = ['#22c55e', '#ef4444'];
  areaFill:       any = { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02 } };
  areaDataLabels: any = { enabled: false };
  areaGrid:       any = { borderColor: '#f1f5f9', strokeDashArray: 4 };
  areaTooltip:    any = { y: { formatter: (v: number) => this.formatCurrency(v) } };
  areaYaxis:      any = {
    labels: {
      style: { colors: '#94a3b8', fontSize: '11px' },
      formatter: (v: number) => {
        if (v >= 1_000_000) return 'R$ ' + (v / 1_000_000).toFixed(1) + 'M';
        if (v >= 1_000)     return 'R$ ' + (v / 1_000).toFixed(0) + 'k';
        return 'R$ ' + v.toFixed(0);
      },
    },
  };

  // Campos simples — só atualizam quando chamamos atualizarGrafico()
  areaSeries: any[] = [];
  areaXaxis:  any   = {};

  setPeriodoGrafico(p: PeriodoGrafico): void {
    this.periodoGrafico = p;
    this.atualizarGrafico();
  }

  atualizarGrafico(): void {
    const meses    = Number(this.periodoGrafico.replace('M', ''));
    const hoje     = new Date();
    const mesesArr: string[] = [];
    const labels:   string[] = [];

    for (let i = meses - 1; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      mesesArr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      labels.push(d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
    }

    const receitas = mesesArr.map(m =>
      this.lancamentos
        .filter(l => l.tipo === 'RECEITA' && l.status === 'PAGO' && (l.dataPagamento ?? '').startsWith(m))
        .reduce((acc, l) => acc + Number(l.valor), 0)
    );
    const despesas = mesesArr.map(m =>
      this.lancamentos
        .filter(l => l.tipo === 'DESPESA' && l.status === 'PAGO' && (l.dataPagamento ?? '').startsWith(m))
        .reduce((acc, l) => acc + Number(l.valor), 0)
    );

    this.areaSeries = [
      { name: 'Receita', data: receitas },
      { name: 'Despesa', data: despesas },
    ];
    this.areaXaxis = {
      categories: labels,
      labels: { style: { colors: '#94a3b8', fontSize: '11px' } },
    };
  }

  // ── Configuração da tabela ──────────────────────────────────
  readonly colunas: TableColumn[] = [
    {
      field: 'dataVencimento',
      header: 'Data',
      width: '11%',
      type: 'date',
    },
    {
      field: '__descricao',
      header: 'Descrição',
      width: '28%',
      type: 'computed',
      truncate: true,
      valueFn: (l: LancamentoFinanceiroResponse) =>
        l.clienteNome ? `${l.descricao} — ${l.clienteNome}` : l.descricao,
    },
    {
      field: 'categoria',
      header: 'Categoria',
      width: '14%',
      type: 'text',
    },
    {
      field: 'tipo',
      header: 'Tipo',
      width: '10%',
      type: 'tag',
      tagSeverityFn: (val) => val === 'RECEITA' ? 'success' : 'danger',
      tagLabelFn:    (val) => val === 'RECEITA' ? 'Receita'  : 'Despesa',
    },
    {
      field: 'valor',
      header: 'Valor',
      width: '13%',
      type: 'currency',
    },
    {
      field: 'status',
      header: 'Status',
      width: '12%',
      type: 'tag',
      tagSeverityFn: (_: StatusLancamento, row: LancamentoFinanceiroResponse) => this.statusSeverity(this.statusEfetivo(row)),
      tagLabelFn:    (_: StatusLancamento, row: LancamentoFinanceiroResponse) => this.statusLabel(this.statusEfetivo(row)),
    },
  ];

  readonly acoes: TableActionConfig = {
    showView:   true,
    showEdit:   true,
    showDelete: true,
    editIcon:    'pi pi-pencil',
    editTooltip: 'Editar',
    deleteHeader:    'Confirmar exclusão',
    deleteMessageFn: (l: LancamentoFinanceiroResponse) =>
      `Deseja excluir o lançamento "${l.descricao}" de ${this.formatCurrency(l.valor)}?`,
  };

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    this.carregar();
    this.carregarClientes();
  }

  carregar(): void {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (data) => {
        this.lancamentos = data;
        this.loading = false;
        this.atualizarGrafico();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loading = false;
        const detail = err?.error?.message ?? 'Não foi possível carregar os lançamentos.';
        this.toast('error', 'Erro', detail);
        this.cdr.detectChanges();
      },
    });
  }

  private carregarClientes(): void {
    this.clientesService.getClientes().subscribe({
      next: (data) => {
        this.clientes = data.map(c => ({ id: c.id, nome: c.nome }));
        this.cdr.detectChanges();
      },
    });
  }

  // ── KPIs (calculados a partir da lista completa do mês) ────
  get resumoMes(): ResumoMesResponse {
    const hoje     = new Date();
    const anoMes   = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    const doMes = this.lancamentos.filter(
      l => (l.dataVencimento ?? '').startsWith(anoMes)
    );

    const receitasMes = doMes
      .filter(l => l.tipo === 'RECEITA' && l.status === 'PAGO')
      .reduce((acc, l) => acc + Number(l.valor), 0);

    const despesasMes = doMes
      .filter(l => l.tipo === 'DESPESA' && l.status === 'PAGO')
      .reduce((acc, l) => acc + Number(l.valor), 0);

    const vencidos = this.lancamentos.filter(l => this.isVencido(l));

    return {
      receitasMes,
      despesasMes,
      saldoPeriodo:  receitasMes - despesasMes,
      totalVencidos: vencidos.reduce((acc, l) => acc + Number(l.valor), 0),
      qtdVencidos:   vencidos.length,
    };
  }

  // ── Filtro client-side ─────────────────────────────────────
  get lancamentosFiltrados(): LancamentoFinanceiroResponse[] {
    return this.lancamentos
      .filter(l => {
        const matchTab    = this.filtro.tab === 'TODOS' || l.tipo === this.filtro.tab;
        const matchStatus = this.filtro.status === 'TODOS' || this.statusEfetivo(l) === this.filtro.status;

        const data        = l.dataVencimento ?? '';
        const matchInicio = !this.filtro.dataInicial || data >= this.filtro.dataInicial;
        const matchFim    = !this.filtro.dataFinal   || data <= this.filtro.dataFinal;

        return matchTab && matchStatus && matchInicio && matchFim;
      })
      .sort((a, b) => {
        const da = new Date(a.createdAt).getTime();
        const db = new Date(b.createdAt).getTime();
        return this.ordenacao === 'recente' ? db - da : da - db;
      });
  }

  get temFiltroAtivo(): boolean {
    const f = this.filtro;
    return f.tab !== 'TODOS'
      || f.status !== 'TODOS'
      || !!f.dataInicial
      || !!f.dataFinal;
  }

  setTab(tab: TabFiltroFinanceiro): void {
    this.filtro = { ...this.filtro, tab };
  }

  limparFiltros(): void {
    this.filtro = { ...FILTRO_FINANCEIRO_PADRAO };
  }

  // ── Status efetivo (vencido calculado no front) ────────────
  statusEfetivo(l: LancamentoFinanceiroResponse): StatusLancamento {
    if (l.status === 'PAGO' || l.status === 'CANCELADO') return l.status;
    if (this.isVencido(l)) return 'VENCIDO';
    return 'PENDENTE';
  }

  private isVencido(l: LancamentoFinanceiroResponse): boolean {
    return l.status === 'PENDENTE'
      && !!l.dataVencimento
      && l.dataVencimento < new Date().toISOString().split('T')[0];
  }

  // ── Modal Criar ────────────────────────────────────────────
  abrirModalCriar(): void {
    this.showModalCriar = true;
  }

  fecharModalCriar(): void {
    this.showModalCriar = false;
  }

  onLancamentoCriado(request: LancamentoFinanceiroRequest): void {
    this.salvando = true;
    this.service.criar(request).subscribe({
      next: (criado) => {
        this.lancamentos = [criado, ...this.lancamentos];
        this.salvando = false;
        this.showModalCriar = false;
        this.toast('success', 'Lançamento criado', criado.descricao);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.salvando = false;
        const detail = err?.error?.message ?? 'Não foi possível criar o lançamento';
        this.toast('error', 'Erro', detail);
        this.cdr.detectChanges();
      },
    });
  }

  // ── Modal Detalhe ──────────────────────────────────────────
  abrirDetalhe(lancamento: LancamentoFinanceiroResponse): void {
    this.lancamentoSelecionado = lancamento;
    this.showModalDetalhe = true;
  }

  fecharDetalhe(): void {
    this.showModalDetalhe = false;
    this.lancamentoSelecionado = null;
  }

  onEditarDoDetalhe(lancamento: LancamentoFinanceiroResponse): void {
    this.fecharDetalhe();
    this.abrirEdicao(lancamento);
  }

  // ── Pagar ──────────────────────────────────────────────────
  onPagar(id: string): void {
    this.salvando = true;
    this.service.pagar(id).subscribe({
      next: (atualizado) => {
        this.atualizarNaLista(atualizado);
        this.salvando = false;
        this.fecharDetalhe();
        this.toast('success', 'Pago', 'Pagamento registrado com sucesso');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.salvando = false;
        const detail = err?.error?.message ?? 'Não foi possível registrar o pagamento';
        this.toast('error', 'Erro', detail);
        this.cdr.detectChanges();
      },
    });
  }

  // ── Modal Edição ───────────────────────────────────────────
  abrirEdicao(lancamento: LancamentoFinanceiroResponse): void {
    this.lancamentoSelecionado = lancamento;
    this.showModalEdicao = true;
  }

  fecharEdicao(): void {
    this.showModalEdicao = false;
    this.lancamentoSelecionado = null;
  }

  onSalvarEdicao(request: LancamentoAtualizarRequest): void {
    const id = this.lancamentoSelecionado!.id;
    this.salvando = true;
    this.service.atualizar(id, request).subscribe({
      next: (atualizado) => {
        this.atualizarNaLista(atualizado);
        this.salvando = false;
        this.fecharEdicao();
        this.toast('success', 'Editado', 'Lançamento atualizado com sucesso');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.salvando = false;
        const detail = err?.error?.message ?? 'Não foi possível editar o lançamento';
        this.toast('error', 'Erro', detail);
        this.cdr.detectChanges();
      },
    });
  }

  // ── Excluir ────────────────────────────────────────────────
  onExcluir(lancamento: LancamentoFinanceiroResponse): void {
    this.service.deletar(lancamento.id).subscribe({
      next: () => {
        this.lancamentos = this.lancamentos.filter(l => l.id !== lancamento.id);
        this.toast('success', 'Excluído', `"${lancamento.descricao}" removido`);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        const detail = err?.error?.message ?? 'Não foi possível excluir o lançamento';
        this.toast('error', 'Erro', detail);
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

  onAplicarFiltros(filtros: FinanceiroFiltro): void {
    this.filtro = filtros;
    this.showModalFiltros = false;
  }

  // ── Helpers ────────────────────────────────────────────────
  private atualizarNaLista(atualizado: LancamentoFinanceiroResponse): void {
    this.lancamentos = this.lancamentos.map(l =>
      l.id === atualizado.id ? atualizado : l
    );
  }

  private toast(severity: string, summary: string, detail: string): void {
    this.messageService.add({ severity, summary, detail, life: 3000 });
  }

  statusLabel(status: StatusLancamento): string {
    const labels: Record<StatusLancamento, string> = {
      PAGO:      'Pago',
      PENDENTE:  'Pendente',
      VENCIDO:   'Vencido',
      CANCELADO: 'Cancelado',
    };
    return labels[status] ?? status;
  }

  statusSeverity(status: StatusLancamento): 'success' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'PAGO':      return 'success';
      case 'PENDENTE':  return 'warn';
      case 'VENCIDO':   return 'danger';
      case 'CANCELADO': return 'secondary';
    }
  }

  formatCurrency(v: number): string {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
