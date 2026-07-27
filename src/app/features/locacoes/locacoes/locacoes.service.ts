import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { map, Observable } from "rxjs";
import { environment } from "../../../../environments/environment";
import { ClienteSimples, FormaPagamento, LocacaoRequest, LocacaoResponse, ParcelaResponse, ProdutoSimples, StatusLocacao, TipoDesconto } from "../models/locacoes.models";

export interface LocacaoEdicaoPayload {
  formaPagamento: FormaPagamento;
  observacao: string | null;
  dataMovimento: string | null;
  desconto: number | null;
  tipoDesconto: TipoDesconto;
  juros: number | null;
  tipoJuros: TipoDesconto;
}

@Injectable({ providedIn: 'root' })
export class LocacaoService {

  private readonly baseUrl = `${environment.apiUrl}/locacoes`;

  private http = inject(HttpClient);

  getLocacoes(): Observable<LocacaoResponse[]> {
    return this.http.get<{ data: LocacaoResponse[] }>(`${this.baseUrl}`)
      .pipe(map(r => r.data));
  }

  getLocacaoById(id: string): Observable<LocacaoResponse> {
    return this.http.get<{ data: LocacaoResponse }>(`${this.baseUrl}/${id}`)
      .pipe(map(r => r.data));
  }

  getLocacoesByStatus(status: StatusLocacao): Observable<LocacaoResponse[]> {
    return this.http.get<{ data: LocacaoResponse[] }>(`${this.baseUrl}/status/${status}`)
      .pipe(map(r => r.data));
  }

  getLocacoesAtrasadas(): Observable<LocacaoResponse[]> {
    return this.http.get<{ data: LocacaoResponse[] }>(`${this.baseUrl}/atrasadas`)
      .pipe(map(r => r.data));
  }

  postLocacao(request: LocacaoRequest, isOrcamento = false): Observable<LocacaoResponse> {
    const params = isOrcamento ? { params: { isOrcamento: 'true' } } : {};
    return this.http.post<{ data: LocacaoResponse }>(`${this.baseUrl}`, request, params)
      .pipe(map(r => r.data));
  }

  patchEditar(id: string, payload: LocacaoEdicaoPayload): Observable<LocacaoResponse> {
    return this.http.patch<{ data: LocacaoResponse }>(`${this.baseUrl}/${id}`, payload)
      .pipe(map(r => r.data));
  }

  patchDevolver(id: string): Observable<LocacaoResponse> {
    return this.http.patch<{ data: LocacaoResponse }>(`${this.baseUrl}/${id}/devolver`, {})
      .pipe(map(r => r.data));
  }

  patchCancelar(id: string): Observable<LocacaoResponse> {
    return this.http.patch<{ data: LocacaoResponse }>(`${this.baseUrl}/${id}/cancelar`, {})
      .pipe(map(r => r.data));
  }

  patchConfirmar(id: string): Observable<LocacaoResponse> {
    return this.http.patch<{ data: LocacaoResponse }>(`${this.baseUrl}/${id}/confirmar`, {})
      .pipe(map(r => r.data));
  }

  getParcelas(locacaoId: string): Observable<ParcelaResponse[]> {
    return this.http.get<{ data: ParcelaResponse[] }>(`${this.baseUrl}/${locacaoId}/parcelas`)
      .pipe(map(r => r.data));
  }

  patchPagarParcela(lancamentoId: string): Observable<void> {
    return this.http.patch<unknown>(`${environment.apiUrl}/financeiro/${lancamentoId}/pagar`, {})
      .pipe(map(() => void 0));
  }

  getKpis(params: { inicio: string; fim: string }): Observable<number> {
    return this.http.get<{ data: number }>(`${this.baseUrl}/somar-receita`, { params })
      .pipe(map(r => r.data));
  }

  deletar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // Recursos compartilhados — reutilizam endpoints de pedidos enquanto não há endpoint próprio
  getClientes(): Observable<ClienteSimples[]> {
    return this.http.get<{ data: ClienteSimples[] }>(`${environment.apiUrl}/pedidos/clientes`)
      .pipe(map(r => r.data));
  }

  getProdutos(): Observable<ProdutoSimples[]> {
    return this.http.get<{ data: ProdutoSimples[] }>(`${environment.apiUrl}/pedidos/produtos`)
      .pipe(map(r => r.data));
  }
}
