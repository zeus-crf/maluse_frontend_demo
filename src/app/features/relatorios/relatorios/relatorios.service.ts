import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
    KpisResponse,
    ReceitaMensalItemResponse,
    StatusFinanceiroResponse,
    TopClienteResponse,
    TopProdutoResponse,
} from '../models/relatorios.models';

@Injectable({ providedIn: 'root' })
export class RelatoriosService {

    private readonly baseUrl = `${environment.apiUrl}/relatorios`;
    private http = inject(HttpClient);

    kpis(periodo: string): Observable<KpisResponse> {
        return this.http.get<KpisResponse>(`${this.baseUrl}/kpis`, { params: { periodo } });
    }

    receitaMensal(meses: number): Observable<ReceitaMensalItemResponse[]> {
        return this.http.get<ReceitaMensalItemResponse[]>(`${this.baseUrl}/receita-mensal`, { params: { meses } });
    }

    statusFinanceiro(): Observable<StatusFinanceiroResponse> {
        return this.http.get<StatusFinanceiroResponse>(`${this.baseUrl}/status-financeiro`);
    }

    topClientes(limite: number, periodo: string): Observable<TopClienteResponse[]> {
        return this.http.get<TopClienteResponse[]>(`${this.baseUrl}/top-clientes`, { params: { limite, periodo } });
    }

    topProdutos(limite: number, periodo: string): Observable<TopProdutoResponse[]> {
        return this.http.get<TopProdutoResponse[]>(`${this.baseUrl}/top-produtos`, { params: { limite, periodo } });
    }
}
