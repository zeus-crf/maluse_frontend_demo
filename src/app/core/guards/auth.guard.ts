import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../services/auth.service";
import { catchError, map, of } from "rxjs";

export const authGuard: CanActivateFn = () => {

    const auth = inject(AuthService);
    const router = inject(Router);

    // Já autenticado em memória (navegação interna): libera na hora
    if (auth.isAuthenticated()) {
        return true;
    }

    // Primeira visita / F5: valida a sessão com o backend.
    // Antes isso era feito por um APP_INITIALIZER que bloqueava todo o bootstrap;
    // agora só bloqueia a ativação da rota protegida, e o app pinta de imediato.
    return auth.me().pipe(
        map(() => true),
        catchError(() => {
            router.navigate(['/auth/login']);
            return of(false);
        })
    );
}