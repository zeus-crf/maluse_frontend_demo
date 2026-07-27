import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ClienteRequest,
  ClienteAtualizarRequest,
  ClienteResponse,
  ClienteHistoricoResponse,
  ClienteSaldoResponse,
  AbatimentoRequest,
  AbatimentoResultado,
  AbatimentoResumo,
  ObservacaoRequest,
  ObservacaoResponse,
} from '../models/clientes.models';

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private http    = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/clientes`;

  getClientes(): Observable<ClienteResponse[]> {
    return this.http.get<{ data:ClienteResponse[] }>(this.baseUrl).pipe(map(r => r.data));
  }

  getClienteById(id: string): Observable<ClienteResponse> {
    return this.http.get<{ data:ClienteResponse }>(`${this.baseUrl}/${id}`).pipe(map(r => r.data));
  }

  getHistorico(id: string): Observable<ClienteHistoricoResponse> {
    return this.http.get<{ data: ClienteHistoricoResponse }>(`${this.baseUrl}/${id}/historico`).pipe(map( r => r.data))
  }

  getSaldo(id: string): Observable<ClienteSaldoResponse> {
    return this.http.get<{ data:ClienteSaldoResponse }>(`${this.baseUrl}/${id}/saldo`).pipe(map(r => r.data));
  }

  debitar(id: string, request: AbatimentoRequest): Observable<AbatimentoResultado> {
    return this.http.post<{ data:AbatimentoResultado }>(`${this.baseUrl}/${id}/abatimentos`, request).pipe(map(r => r.data));
  }

  getAbatimentos(id: string): Observable<AbatimentoResumo[]> {
    return this.http.get<{ data:AbatimentoResumo[] }>(`${this.baseUrl}/${id}/abatimentos`).pipe(map(r => r.data));
  }

  estornarAbatimento(abatimentoId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/abatimentos/${abatimentoId}/estorno`, {});
  }

  getObservacoes(id: string): Observable<ObservacaoResponse[]> {
    return this.http.get<{ data:ObservacaoResponse[] }>(`${this.baseUrl}/${id}/observacoes`).pipe(map(r => r.data));
  }

  criarObservacao(id: string, request: ObservacaoRequest): Observable<ObservacaoResponse> {
    return this.http.post<{ data:ObservacaoResponse }>(`${this.baseUrl}/${id}/observacoes`, request).pipe(map(r => r.data));
  }

  deletarObservacao(observacaoId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/observacoes/${observacaoId}`);
  }

  criar(request: ClienteRequest): Observable<ClienteResponse> {
    return this.http.post<{ data:ClienteResponse }>(this.baseUrl, request).pipe(map(r => r.data));
  }

  atualizar(id: string, request: ClienteAtualizarRequest): Observable<ClienteResponse> {
    return this.http.put<{ data:ClienteResponse }>(`${this.baseUrl}/${id}`, request).pipe(map(r => r.data));
  }


  inativar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
