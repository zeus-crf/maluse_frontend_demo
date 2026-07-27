import { HttpClient } from "@angular/common/http";
import { inject, Inject, Injectable } from "@angular/core";
import { environment } from "../../../../environments/environment";
import { map, Observable } from "rxjs";

export interface FornecedorResponse {
  id: string;
  nome: string;
}

@Injectable({ providedIn: 'root'})
export class FornecedoresService {

    private http = inject(HttpClient)
    private baseUrl = `${environment.apiUrl}/fornecedores`;

    listar(): Observable<FornecedorResponse[]> {
        return this.http.get<{ data: FornecedorResponse[]}>(this.baseUrl)
            .pipe(map(r => r.data));
    }



}