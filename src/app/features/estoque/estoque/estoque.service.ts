import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ProdutoRequest, ProdutoResponse, ProdutoAtualizarRequest } from '../models/estoque.models';

@Injectable({ providedIn: 'root' })
export class EstoqueService {
  private http    = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/produtos`;

  getProdutos(): Observable<ProdutoResponse[]> {
    return this.http.get<any>(this.baseUrl).pipe(map(r => r.data));
  }

  getRascunhos(): Observable<ProdutoResponse[]> {
    return this.http.get<{ data: ProdutoResponse[] }>(`${this.baseUrl}/rascunhos`)
      .pipe(map(r => r.data))
  }

  criar(request: ProdutoRequest): Observable<ProdutoResponse> {
    return this.http.post<any>(this.baseUrl, request).pipe(map(r => r.data));
  }

  atualizar(id: string, request: ProdutoAtualizarRequest): Observable<ProdutoResponse> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, request).pipe(map(r => r.data));
  }

  inativar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
