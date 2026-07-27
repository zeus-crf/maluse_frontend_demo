export type StatusPedido = 'ORCAMENTO' | 'PENDENTE' | 'CONFIRMADO' | 'PAGO' | 'CANCELADO';

export type StatusEntrega = 'PENDENTE' | 'FEITA';

export interface EntregaResponse {
  id: string;
  endereco: string;
  dataPrevista: string | null;
  dataEntrega: string | null;
  status: StatusEntrega;
}

export interface EntregaRequest {
  endereco: string;
  dataPrevista?: string | null;
}

export interface EntregaAtualizarRequest {
  endereco?: string;
  dataPrevista?: string | null;
}

export type FormaPagamento = 'DINHEIRO' | 'PIX' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO' | 'BOLETO' | 'FIADO';

export type TipoDesconto = 'PERCENTUAL' | 'VALOR';

export type UnidadeMedida = 'SACO' | 'METRO' | 'METRO_QUADRADO' | 'LITRO' | 'PECA' | 'KG'| 'ROLO' | 'BALDE';

export type StatusLancamento = 'PENDENTE' | 'PAGO' | 'CANCELADO';

export interface ParcelaResponse {
  id: string;
  numeroParcela: number;
  totalParcelas: number;
  valor: number;
  dataVencimento: string | null;
  status: StatusLancamento;
  dataPagamento: string | null;
}

export interface ItemPedidoResponse {
  id: string;
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  baixarEstoque: boolean;
  permitirSemEstoque: boolean;
}
 
export interface PedidoResponse {
  id: string;
  numero: number;
  clienteId: string | null;
  clienteNome: string;
  clienteTelefone: string | null;
  status: StatusPedido;
  formaPagamento: FormaPagamento;
  valorTotal: number;
  valorBruto: number;
  desconto: number | null;
  tipoDesconto: TipoDesconto | null;
  descontoAplicadoEm: string | null;
  observacao: string | null;
  itens: ItemPedidoResponse[];
  createdAt: string;
  dataMovimento: string;          // 'YYYY-MM-DD' — data real da transação
  dataVencimento: string | null; // 'YYYY-MM-DD', só para FIADO
  parcelas: ParcelaResponse[];
  parcelaMesAtual: ParcelaResponse | null;
  entrega: EntregaResponse | null;
  juros: number | null;
  tipoJuros: TipoDesconto | null;
  jurosAplicadoEm: string | null;
}

export interface ItemPedidoRequest {
  productId?: string;
  produtoNome?: string;
  quantidade: number;
  preco?: number;
  baixarEstoque?: boolean;
  permitirSemEstoque?: boolean;
}
 
export interface PedidoRequest {
  clienteId?: string;
  formaPagamento: FormaPagamento;
  itens: ItemPedidoRequest[];
  observacao?: string;
  status?: StatusPedido;
  dataMovimento?: string;         // 'YYYY-MM-DD' — data real da transação
  dataVencimento?: string;        // 'YYYY-MM-DD', só para FIADO (1 parcela)
  desconto?: number | null;
  tipoDesconto?: TipoDesconto | null;
  numeroParcelas?: number;
  primeiroVencimento?: string;   // 'YYYY-MM-DD'
  entrega?: EntregaRequest | null;
  juros?: number | null;
  tipoJuros?: TipoDesconto | null;
}

export interface PedidoAtualizarRequest {
  formaPagamento?: FormaPagamento;
  observacao?: string;
  dataMovimento?: string;         // 'YYYY-MM-DD'
  desconto?: number | null;
  tipoDesconto?: TipoDesconto | null;
  juros?: number | null;
  tipoJuros?: TipoDesconto | null;
}

export interface ProdutoSimples {
  id: string;
  nome: string;
  preco: number;
  quantidadeEstoque: number;
  medida: UnidadeMedida;
}
 
export interface ClienteSimples {
  id: string;
  nome: string;
}

export interface ItemPedidoForm {
  productId: string;
  produtoNome: string;
  preco: number;
  quantidade: number;
  baixarEstoque: boolean;
}

export interface VendasFiltro {
    inicio: string;
    fim: string;
}

export interface VendasFiltroCompleto {
  status: StatusPedido | 'TODOS';
  formaPagamento: FormaPagamento | 'TODOS';
  inicio: string;
  fim: string;
  minValor: number | null;
  maxValor: number | null;
}

export interface ClienteResponse {
    id: string;
    nome: string;
    cpfCnpj: string;
    telefone: string;
    email: string;
    endereco: string;
    consumidorFinal: boolean;
    ativo: boolean;
}

export interface ProdutoResponse {
    id: string;
    nome: string;
    descricao: string;
    preco: number;
    quantidadeEstoque: number;
    estoqueMinimo: number;
    ativo: boolean;
    estoqueBaixo: boolean;
    medida: UnidadeMedida;
    rascunho: boolean;
}
