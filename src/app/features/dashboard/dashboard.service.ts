import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DashboardFiltro,
  DashboardKpisResponse,
  GraficoItemResponse,
  EstoqueCriticoResponse,
  LocacaoEmCursoResponse,
  ProdutoRascunhoResponse,
} from './models/dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly base = `${environment.apiUrl}/dashboard`;

  constructor(private http: HttpClient) {}

  getKpis(filtro: DashboardFiltro) {
    return this.http
      .get<{ data: DashboardKpisResponse }>(`${this.base}/kpis`, {
        params: { inicio: filtro.inicio, fim: filtro.fim }
      })
      .pipe(map(r => r.data));
  }

  getGrafico(filtro: DashboardFiltro) {
    return this.http
      .get<{ data: GraficoItemResponse[] }>(`${this.base}/grafico`, {
        params: { inicio: filtro.inicio, fim: filtro.fim }
      })
      .pipe(map(r => r.data));
  }

  getEstoqueCritico() {
    return this.http
      .get<{ data: EstoqueCriticoResponse[] }>(`${this.base}/estoque-critico`)
      .pipe(map(r => r.data));
  }

  getLocacoesEmCurso() {
    return this.http
      .get<{ data: LocacaoEmCursoResponse[] }>(`${this.base}/locacoes-em-curso`)
      .pipe(map(r => r.data));
  }

  getRascunhos() {
    return this.http
      .get<{ data: ProdutoRascunhoResponse[] }>(`${environment.apiUrl}/produtos/rascunhos`)
      .pipe(map(r => r.data));
  }
}
