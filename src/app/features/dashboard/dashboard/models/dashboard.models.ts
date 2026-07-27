export interface DashboardKpis {
  receita: number;
  lucroLiquido: number;
  margemLucro: number;
  variacaoReceita: number;
  equipamentosAlugados: number;
  equipamentosDisponiveis: number;
  equipamentosAtrasados: number;
  clientesAtivos: number;
  novosClientesMes: number;
}

export interface ReceitaDespesasMensal {
  mes: string;
  receita: number;
  despesas: number;
}

export interface EquipamentosStatus {
  alugados: number;
  disponiveis: number;
  atrasados: number;
  manutencao: number;
}

export interface Atividade {
  tipo: 'venda' | 'locacao' | 'cliente' | 'estoque' | 'financeiro';
  descricao: string;
  valor?: number;
  badge?: string;
  criadoEm: string;
}

export interface EstoqueBaixo {
  nome: string;
  qtdAtual: number;
  qtdMinima: number;
  unidade: string;
}

export interface LocacaoAtrasada {
  equipamento: string;
  cliente: string;
  dataDevolucao: string;
}

export interface DashboardFiltro {
  startDate: string;
  endDate: string;
}