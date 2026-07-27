// ── Filtro ────────────────────────────────────────────────────
export interface DashboardFiltro {
  inicio: string;
  fim: string;
}

// ── Respostas reais da API ────────────────────────────────────
export interface DashboardKpisResponse {
  receitaPeriodo: number;
  vendasValor: number;
  vendasQuantidade: number;
  locacoesAtivas: number;
  locacoesAtivasValor: number;
  clientesAtivos: number;
}

export interface GraficoItemResponse {
  dia: string;        // ISO date: "2025-01-15"
  vendas: number;
  locacoes: number;
}

export interface EstoqueCriticoResponse {
  id: string;
  nome: string;
  quantidadeAtual: number;
  estoqueMinimo: number;
  preco: number;
}

export interface ProdutoRascunhoResponse {
  id: string;
  nome: string;
  preco: number;
}

export type StatusLocacao = 'ATIVA' | 'ATRASADA' | 'CONCLUIDA' | 'CANCELADA';

export interface LocacaoEmCursoResponse {
  id: string;
  clienteNome: string;
  produtoNome: string;
  dataDevolucao: string;  // ISO date
  status: StatusLocacao;
}

// ── Tipo derivado para o gráfico (agrupado por mês) ──────────
export interface GraficoMensal {
  mes: string;
  vendas: number;
  locacoes: number;
}
