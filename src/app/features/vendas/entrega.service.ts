import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { map, Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { EntregaAtualizarRequest, EntregaResponse } from "./models/vendas.models";

@Injectable({ providedIn: 'root' })
export class EntregaService {

    private readonly baseUrl = `${environment.apiUrl}/entregas`;
    private http = inject(HttpClient);

    patchEntregar(id: string): Observable<EntregaResponse> {
        return this.http.patch<{ data: EntregaResponse }>(`${this.baseUrl}/${id}/entregar`, {})
            .pipe(map(r => r.data));
    }

    putEditar(id: string, request: EntregaAtualizarRequest): Observable<EntregaResponse> {
        return this.http.put<{ data: EntregaResponse }>(`${this.baseUrl}/${id}`, request)
            .pipe(map(r => r.data));
    }
}
