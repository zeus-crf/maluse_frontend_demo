export interface KpisResponse {
    receita: number;
    despesas: number;
    saldo: number;
    ticketMedio: number;
    totalPedidos: number;
    variacaoReceita: number | null;
    variacaoDespesas: number | null;
    variacaoSaldo: number | null;
    variacaoTicketMedio: number | null;
    cmv: number;
    lucroLiquido: number;
}

export interface ReceitaMensalItemResponse {
    mes: string;
    vendas: number;
    locacoes: number;
    despesas: number;
    cmv: number;
}

export interface StatusFinanceiroResponse {
    pagos: number;
    pendentes: number;
    vencidos: number;
}

export interface TopClienteResponse {
    nome: string;
    total: number;
}

export interface TopProdutoResponse {
    nome: string;
    quantidade: number;
    lucro: number;
    custo: number;
    total: number;
}
