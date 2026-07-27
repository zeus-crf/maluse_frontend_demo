import { Injectable, signal, computed } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { tap } from "rxjs";
import { environment } from "../../../environments/environment";

interface AuthData {
  nome: string;
  email: string;
}


@Injectable({ providedIn: 'root' })
export class AuthService {


  currentUser = signal<AuthData | null>(null);


  isAuthenticated = computed(() => this.currentUser() !== null);


  // Iniciais do nome para o avatar
  initials = computed(() => {
    const nome = this.currentUser()?.nome ?? '';
    return nome.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('');
  });

  constructor(private http: HttpClient) {}

  login(email: string, password: string) {
    return this.http.post<{ message: string; data: AuthData }>(
      `${environment.apiUrl}/auth/login`,
      { email, password }
    ).pipe(tap(r => this.currentUser.set(r.data)));
  }

  register(nome: string, email: string, password: string) {
    return this.http.post<{ message: string; data: AuthData }>(
      `${environment.apiUrl}/auth/register`,
      { email, nome, password }
    ).pipe(tap(r => this.currentUser.set(r.data)));
  }

  me(){
    return this.http.get<{ data: AuthData }>(`${environment.apiUrl}/auth/me`)
      .pipe(tap(r => this.currentUser.set(r.data)));
  }

  logout(){
    return this.http.post<void>(`${environment.apiUrl}/auth/logout`, 
      {},).pipe(tap( r => this.currentUser.set(null)))
  }

  refresh() {
    return this.http.post<{ data: AuthData }>(`${environment.apiUrl}/auth/refresh`, {})
      .pipe(tap(r => this.currentUser.set(r.data)))
  }

}
