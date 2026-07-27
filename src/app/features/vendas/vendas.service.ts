import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { map, Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { ClienteResponse, ClienteSimples, ParcelaResponse, PedidoAtualizarRequest, PedidoRequest, PedidoResponse, ProdutoResponse, ProdutoSimples, StatusPedido, VendasFiltro } from "./models/vendas.models";

@Injectable({ providedIn: 'root' })
export class VendasService {

    private readonly baseUrl = `${environment.apiUrl}/pedidos`;

    private http = inject(HttpClient);

    getKpis(filtro: VendasFiltro) {
        return this.http.get<{ data: number }>(`${this.baseUrl}/somar-vendas`, {
            params: { inicio: filtro.inicio, fim: filtro.fim }
        })
         .pipe(map(r => r.data));
    }

    getPedidos(): Observable<PedidoResponse[]>{
        return this.http.get<{data: PedidoResponse[] }>(`${this.baseUrl}`)
        .pipe(map( r => r.data))
    }

    getByPedidoId(id: string): Observable<PedidoResponse>{
        return this.http.get<{data: PedidoResponse }>(`${this.baseUrl}/${id}`)
        .pipe(map( r => r.data))
    }

    getByStatus(status: StatusPedido): Observable<PedidoResponse[]>{
        return this.http.get<{ data: PedidoResponse[]}>(`${this.baseUrl}/status/${status}`)
            .pipe(map( r => r.data))
        
    }

    getClientes(): Observable<ClienteSimples[]>{
        return this.http.get<{ data: ClienteResponse[] }>(`${this.baseUrl}/clientes`)
            .pipe(map(r => r.data));
    }

    getProdutos(): Observable<ProdutoSimples[]>{
        return this.http.get<{ data: ProdutoResponse[] }>(`${this.baseUrl}/produtos`)
            .pipe(map(r => r.data));
    }

    postPedidos(pedido: PedidoRequest): Observable<PedidoResponse> {
    return this.http
        .post<{ data: PedidoResponse }>(
            `${this.baseUrl}`,
            pedido
        )
        .pipe(
            map(r => r.data)
        );
    }

    patchPagarPedido(id: string): Observable<PedidoResponse> {
        return this.http.patch<{data: PedidoResponse}>(`${this.baseUrl}/${id}/pagar`, {})
            .pipe(map(r => r.data))
    }

    putEditarVenda(id: string, pedido: PedidoAtualizarRequest): Observable<PedidoResponse> {
        return this.http.put<{ data: PedidoResponse }>(`${this.baseUrl}/${id}` , pedido)
        .pipe(map (r => r.data))
    }

    patchCancelarPedido(id: string): Observable<PedidoResponse> {
        return this.http.patch<{data: PedidoResponse}>(`${this.baseUrl}/${id}/cancelar`, {})
            .pipe(map(r => r.data))
    }

    patchConfirmarPedido(id: string): Observable<PedidoResponse> {
        return this.http.patch<{data: PedidoResponse}>(`${this.baseUrl}/${id}/confirmar`, {})
            .pipe(map(r => r.data))
    }

    getParcelas(pedidoId: string): Observable<ParcelaResponse[]> {
        return this.http.get<{ data: ParcelaResponse[] }>(`${this.baseUrl}/${pedidoId}/parcelas`)
            .pipe(map(r => r.data));
    }

    patchPagarParcela(lancamentoId: string): Observable<void> {
        return this.http.patch<unknown>(`${environment.apiUrl}/financeiro/${lancamentoId}/pagar`, {})
            .pipe(map(() => void 0));
    }

    deletePedido(id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${id}`);
    }

}