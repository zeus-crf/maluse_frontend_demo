import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, finalize, ReplaySubject, switchMap, take, throwError } from "rxjs";
import { AuthService } from "../services/auth.service";

/**
 * Estado compartilhado do refresh de token.
 *
 * `refreshSubject` é um ReplaySubject (não um Subject comum) de propósito: uma requisição que
 * comece a esperar depois que o refresh terminou ainda recebe o resultado. Com Subject comum ela
 * receberia apenas o "complete" e morreria em silêncio — sem next e sem error —, deixando a tela
 * eternamente em "carregando".
 */
let isRefreshing = false;
let refreshSubject = new ReplaySubject<boolean>(1);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  const authReq = req.clone({ withCredentials: true });

  return next(authReq).pipe(
    catchError(error => {
      // Evita loop infinito: não tenta refresh se o erro veio do próprio refresh,
      // do login ou do register. /auth/me é um endpoint protegido normal — deve sim
      // disparar o refresh quando o access token expirar.
      const skipRefresh =
        req.url.includes('/auth/refresh') ||
        req.url.includes('/auth/login') ||
        req.url.includes('/auth/register');

      if ((error.status === 401 || error.status === 403) && !skipRefresh) {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshSubject = new ReplaySubject<boolean>(1);

          return auth.refresh().pipe(
            switchMap(() => {
              refreshSubject.next(true);
              return next(authReq);
            }),
            catchError(refreshError => {
              refreshSubject.next(false);
              auth.logout().subscribe();
              router.navigate(['/auth/login']);
              return throwError(() => refreshError);
            }),
            // finalize roda inclusive quando a inscrição é cancelada — por exemplo, se o
            // componente que fez a requisição for destruído no meio do refresh. Sem isso,
            // isRefreshing ficaria travado em true e TODA requisição seguinte que tomasse
            // 401 esperaria para sempre.
            finalize(() => { isRefreshing = false; })
          );
        }

        // Outro request já está renovando o token — aguarda o resultado e repete.
        return refreshSubject.pipe(
          take(1),
          switchMap(renovou => renovou ? next(authReq) : throwError(() => error))
        );
      }

      return throwError(() => error);
    })
  );
};
