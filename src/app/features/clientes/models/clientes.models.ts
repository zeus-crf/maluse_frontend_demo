export type TipoCliente    = 'PF' | 'PJ';
export type TabFiltroCliente = 'TODOS' | TipoCliente;

export interface PedidosResumo {
  id: string;
  numero: number;
  status: string;
  formaPagamento: string;
  valorTotal: number;
  dataMovimento: string;
}

export interface LocacaoResumo {
  id: string;
  numero: number;
  status: string;
  formaPagamento: string;
  valorTotal: number;
  dataRetirada: string;
  dataDevolucaoPrevista: string;
}

export interface ClienteRequest {
  nome:           string;
  cpfCnpj?:       string;
  telefone?:      string;
  email?:         string;
  endereco?:      string;
  consumidorFinal: boolean;
}

export interface ClienteResponse {
  id:             string;
  nome:           string;
  cpfCnpj:        string;
  telefone:       string;
  email:          string;
  endereco:       string;
  consumidorFinal: boolean;
  ativo:          boolean;
  totalGasto:     number;
}

export interface ClienteAtualizarRequest {
  nome:      string;
  cpfCnpj?:  string;
  telefone?: string;
  email?:    string;
  endereco?: string;
}

export interface ClienteFiltroCompleto {
  tipoCliente:  TabFiltroCliente;
  dataInicial:  string | null;
  dataFinal:    string | null;
  minCompras:   number | null;
  maxCompras:   number | null;
}

export interface ClienteHistoricoResponse {
  pedidos: PedidosResumo[];
  locacoes: LocacaoResumo[];
}

/** Origem de uma dívida em aberto. LANCAMENTO = receita lançada direto no financeiro
 *  para o cliente, sem pedido nem locação — não tem número. */
export type OrigemDivida = 'PEDIDO' | 'LOCACAO' | 'LANCAMENTO';

export interface ItemDevido {
  origemTipo:  OrigemDivida;
  origemId:    string;
  numero:      number | null;
  data:        string;
  valorTotal:  number;
  valorPago:   number;
  saldo:       number;
}

export interface ClienteSaldoResponse {
  saldoDevedor: number;
  itens:        ItemDevido[];
}

export interface AbatimentoRequest {
  valor:       number;
  observacao?: string;
}

export interface AbatimentoResultado {
  abatimentoId:  string;
  valorAbatido:  number;
  saldoAnterior: number;
  saldoAtual:    number;
  data:          string;
}

export interface AbatimentoResumo {
  id:         string;
  valor:      number;
  data:       string;
  observacao: string | null;
  estornado:  boolean;
}

export interface ObservacaoRequest {
  texto: string;
}

export interface ObservacaoResponse {
  id:        string;
  texto:     string;
  autorNome: string;
  /** ISO datetime — vem do createdAt da entidade */
  criadaEm:  string;
}

export const FILTRO_CLIENTE_PADRAO: ClienteFiltroCompleto = {
  tipoCliente: 'TODOS',
  dataInicial: null,
  dataFinal:   null,
  minCompras:  null,
  maxCompras:  null,
};
