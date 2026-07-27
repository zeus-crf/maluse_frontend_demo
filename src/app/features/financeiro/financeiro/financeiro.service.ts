import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  LancamentoAtualizarRequest,
  LancamentoFinanceiroRequest,
  LancamentoFinanceiroResponse,
  ResumoDiaResponse,
} from '../models/financeiro.models';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FinanceiroService {

  private readonly baseUrl = `${environment.apiUrl}/financeiro`;
  private http = inject(HttpClient);

  getAll(): Observable<LancamentoFinanceiroResponse[]> {
    return this.http.get<{ data: LancamentoFinanceiroResponse[] }>(this.baseUrl)
      .pipe(map(r => r.data));
  }

  getById(id: string): Observable<LancamentoFinanceiroResponse> {
    return this.http.get<{ data: LancamentoFinanceiroResponse }>(`${this.baseUrl}/${id}`)
      .pipe(map(r => r.data));
  }

  getPendentes(): Observable<LancamentoFinanceiroResponse[]> {
    return this.http.get<{ data: LancamentoFinanceiroResponse[] }>(`${this.baseUrl}/pendentes`)
      .pipe(map(r => r.data));
  }

  getVencidos(): Observable<LancamentoFinanceiroResponse[]> {
    return this.http.get<{ data: LancamentoFinanceiroResponse[] }>(`${this.baseUrl}/vencidos`)
      .pipe(map(r => r.data));
  }

  getGrupoRecorrencia(grupoId: string): Observable<LancamentoFinanceiroResponse[]> {
    return this.http.get<{ data: LancamentoFinanceiroResponse[] }>(`${this.baseUrl}/recorrencia/${grupoId}`)
      .pipe(map(r => r.data));
  }

  getResumoDia(): Observable<ResumoDiaResponse> {
    return this.http.get<{ data: ResumoDiaResponse }>(`${this.baseUrl}/resumo-dia`)
      .pipe(map(r => r.data));
  }

  criar(request: LancamentoFinanceiroRequest): Observable<LancamentoFinanceiroResponse> {
    return this.http.post<{ data: LancamentoFinanceiroResponse }>(this.baseUrl, request)
      .pipe(map(r => r.data));
  }

  atualizar(id: string, request: LancamentoAtualizarRequest): Observable<LancamentoFinanceiroResponse> {
    return this.http.patch<{ data: LancamentoFinanceiroResponse }>(`${this.baseUrl}/${id}`, request)
      .pipe(map(r => r.data));
  }

  pagar(id: string): Observable<LancamentoFinanceiroResponse> {
    return this.http.patch<{ data: LancamentoFinanceiroResponse }>(`${this.baseUrl}/${id}/pagar`, {})
      .pipe(map(r => r.data));
  }

  cancelarRecorrencia(grupoId: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/recorrencia/${grupoId}/cancelar`, {});
  }

  deletar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
