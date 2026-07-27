// ──────────────────────────────────────────────
// Enums / union types
// ──────────────────────────────────────────────

export type Recorrencia = 'DIARIA' | 'SEMANAL' | 'MENSAL' | 'ANUAL';

export type StatusLancamento = 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'CANCELADO';

export type TipoLancamento = 'RECEITA' | 'DESPESA';

/** Tab de filtro rápido na toolbar da tabela */
export type TabFiltroFinanceiro = 'TODOS' | TipoLancamento;

/** Período do gráfico de fluxo de caixa */
export type PeriodoGrafico = '3M' | '6M' | '12M';

// ──────────────────────────────────────────────
// Requests
// ──────────────────────────────────────────────

export interface LancamentoFinanceiroRequest {
  tipo:           TipoLancamento;
  categoria:      string;
  descricao:      string;
  valor:          number;
  status?:        StatusLancamento;
  dataPagamento?: string | null;
  dataVencimento: string;
  clienteId?:     string | null;
  recorrencia?:   Recorrencia | null;
}

/** PATCH — todos os campos são opcionais */
export interface LancamentoAtualizarRequest {
  tipo?:           TipoLancamento;
  categoria?:      string;
  descricao?:      string;
  valor?:          number;
  status?:         StatusLancamento;
  dataVencimento?: string;
  dataPagamento?:  string | null;
}

// ──────────────────────────────────────────────
// Responses
// ──────────────────────────────────────────────

export interface LancamentoFinanceiroResponse {
  id:                string;
  tipo:              TipoLancamento;
  categoria:         string;
  descricao:         string;
  valor:             number;
  dataVencimento:    string;
  dataPagamento:     string | null;
  status:            StatusLancamento;
  clienteId:         string | null;
  clienteNome:       string | null;
  recorrencia:       Recorrencia | null;
  recorrenciaGrupoId: string | null;
  recorrenciaAtiva:  boolean;
  pedidoId:          string | null;
  locacaoId:         string | null;
  createdAt:         string;
}

export interface ResumoDiaResponse {
  data:           string;
  totalReceitas:  number;
  totalDespesas:  number;
  saldo:          number;
}

/** KPIs calculados no frontend a partir da lista de lançamentos do mês */
export interface ResumoMesResponse {
  receitasMes:   number;
  despesasMes:   number;
  saldoPeriodo:  number;
  totalVencidos: number;
  qtdVencidos:   number;
}

// ──────────────────────────────────────────────
// Filtros
// ──────────────────────────────────────────────

export interface FinanceiroFiltro {
  tab:           TabFiltroFinanceiro;
  busca:         string;
  status:        StatusLancamento | 'TODOS';
  dataInicial:   string | null;
  dataFinal:     string | null;
  categorias:    string[];
  periodoGrafico: PeriodoGrafico;
}

export const FILTRO_FINANCEIRO_PADRAO: FinanceiroFiltro = {
  tab:            'TODOS',
  busca:          '',
  status:         'TODOS',
  dataInicial:    null,
  dataFinal:      null,
  categorias:     [],
  periodoGrafico: '6M',
};
