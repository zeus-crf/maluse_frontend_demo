# Performance Backlog — marluse-frontend

Varredura feita em 2026-07-14. Nenhuma alteração aplicada ainda.
Ordenado por impacto esperado.

---

## 🔴 P1 — Crítico (maior impacto em prod)

### [P1-A] Deploy no Railway: trocar `ng serve` por servidor estático otimizado

**Problema:** `package.json#start` é `ng serve` (dev-server). Railway roda `npm start` → o app em prod está sendo servido pelo Vite em modo dev, sem build otimizado, sem gzip, sem cache headers e sem proxy funcional para o backend.

**Solução proposta:** Dockerfile multi-stage nginx
- Stage 1: `node` → `ng build --configuration production`
- Stage 2: `nginx:alpine` servindo `dist/marluse-frontend/browser`
  - gzip on
  - `try_files` para SPA fallback
  - proxy `/api` → URL do backend no Railway
  - cache headers para assets com hash

**Arquivos a criar/modificar:**
- `Dockerfile` (novo)
- `nginx.conf` (novo)
- Variável de ambiente `API_URL` no Railway para o nginx fazer proxy

**Impacto esperado:** muito alto — elimina cold recompile, ativa tree-shaking real, habilita gzip e HTTP cache.

---

### [P1-B] APP_INITIALIZER bloqueante no bootstrap

**Problema:** `src/app/app.config.ts:60` — o `initAuth` chama `auth.me()` e bloqueia toda renderização até o HTTP do backend retornar. Com backend no hobby (cold start), o usuário vê tela branca.

**Solução proposta:** remover o `APP_INITIALIZER`. O `authGuard` já resolve o estado de autenticação por rota. Usar `authGuard` como gate (já está nas rotas protegidas) + redirecionar para login se não autenticado.

**Arquivos a modificar:**
- `src/app/app.config.ts` — remover bloco `APP_INITIALIZER`
- `src/app/core/guards/auth.guard.ts` — garantir que faz o `me()` se necessário

**Impacto esperado:** alto — first-paint imediato, independente da latência do backend.

---

## 🟠 P2 — Importante (peso dos bundles)

### [P2-A] ApexCharts empacotado duas vezes

**Problema:** build gera `apexcharts-esm` (599 kB) + `apexcharts-ssr-esm` (600 kB) = ~1,2 MB. O app não é SSR; a variante SSR não deve existir.

**Solução proposta:** investigar se é bug do `ng-apexcharts@2.x` com Angular 22 e aplicar workaround (override no tsconfig ou trocar para import direto de `apexcharts/dist/apexcharts.esm.js`).

**Impacto esperado:** médio-alto — elimina ~600 kB (135 kB gzip) da primeira navegação para cada rota com gráfico.

---

### [P2-B] Remover `chart.js` das dependências

**Problema:** `chart.js` está em `package.json#dependencies` mas não é usado em lugar nenhum (0 imports no src/). Só `ng-apexcharts` é usado.

**Solução proposta:** `npm remove chart.js`

**Arquivos a modificar:** `package.json`, `package-lock.json`

**Impacto esperado:** baixo em runtime (tree-shaking já exclui), mas limpa o `node_modules` e acelera `npm install` no CI/Railway.

---

### [P2-C] Fontes do Google render-blocking

**Problema:** `src/index.html:9-10` carrega duas fontes do Google (Inter/Geist + Material Symbols) de forma bloqueante, sem `display=swap`, sem `preconnect`. Material Symbols com todos os eixos variáveis é muito pesado.

**Solução proposta:**
1. Adicionar `<link rel="preconnect" href="https://fonts.googleapis.com">` e `fonts.gstatic.com`
2. Adicionar `&display=swap` nas URLs das fontes
3. Estreitar os eixos do Material Symbols: `@20..48,100..700,0..1,-50..200` → `@24,400,0,0` (tamanho fixo, sem animação)

**Arquivos a modificar:** `src/index.html`

**Impacto esperado:** médio — reduz bloqueio de renderização e tamanho do download das fontes.

---

### [P2-D] Bundle inicial acima do budget

**Problema:** bundle inicial = 685 kB (budget é 500 kB). Inclui tema Aura do PrimeNG + módulos compartilhados.

**Solução proposta:** investigar se alguma importação do PrimeNG está sendo puxada para o chunk inicial desnecessariamente. Possível split do tema.

**Impacto esperado:** médio — a depender do que estiver inflando o `main`.

---

## 🟡 P3 — Melhorias

### [P3-A] Nenhum componente usa `ChangeDetectionStrategy.OnPush`

**Problema:** Angular roda CD a cada evento em todos os componentes. Getters que criam objetos (`new Date()`, `.filter()`) rodam a cada ciclo.

**Componentes prioritários para OnPush:** `DataTableComponent`, `DashboardComponent`, `LocacoesComponent`, `VendasComponent`.

**Impacto esperado:** médio em telas com tabelas grandes.

---

### [P3-B] Import morto: `SelectComponent` em `NovaLocacaoModalComponent`

**Problema:** warning no build — `SelectComponent` importado mas não usado no template.

**Arquivo:** `src/app/features/locacoes/nova-locacao-modal/nova-locacao-modal.component.ts:23`

**Solução:** remover da lista de `imports`.

**Impacto esperado:** negligível em runtime, limpa warning do build.

---

## Status

| ID | Status |
|----|--------|
| P1-A | ❌ NÃO SE APLICA — o frontend é servido pelo Vercel (ver vercel.json), não pelo Railway. O Vercel já faz `ng build --configuration production` + CDN + gzip/brotli + cache. Diagnóstico original ("ng serve em prod") estava errado. Arquivos Docker removidos. |
| P1-B | ✅ implementado e verificado (redireciona p/ login sem travar) |
| P2-A | 📋 backlog (adiado nesta rodada) |
| P2-B | ✅ implementado (chart.js removido) |
| P2-C | ✅ implementado e verificado (ícones renderizam) |
| P2-D | 📋 backlog (adiado — warning de budget persiste) |
| P3-A | 📋 backlog (adiado) |
| P3-B | ✅ implementado (warning do build sumiu) |

### Correção importante (2026-07-14)
- **Descoberta tardia:** existe um `vercel.json` na raiz — o frontend é deployado no **Vercel**,
  não no Railway. O Vercel já roda `ng build --configuration production` e serve estático via CDN.
  Portanto o P1-A (Dockerfile/nginx pra substituir `ng serve`) NUNCA foi necessário — o app
  nunca rodou dev-server em produção. Arquivos Docker criados e depois removidos.
- **Backend no Railway hobby** (`marlusebackend-production.up.railway.app`, via rewrite do Vercel)
  é o provável gargalo real de "demora pra carregar dados": cold start + recursos limitados.
  Próximo passo de maior impacto = otimizar/manter o backend acordado, fora deste repo frontend.
- **P1-B (bootstrap não-bloqueante)** segue sendo a maior melhoria deste repo: antes o app ficava
  em tela branca esperando o `/auth/me` do backend lento; agora pinta imediatamente.
- **Deploy P1-A ainda precisa de ação sua no Railway:**
  1. Definir a variável de ambiente `API_URL` (ex: `https://<backend>.up.railway.app`, sem barra final).
  2. Garantir que o serviço use o Dockerfile (Railway detecta automaticamente se houver Dockerfile na raiz).
  3. Se `API_URL` não estiver setada, o nginx falha ao subir de propósito (evita deploy quebrado).

---

## Arquivos propostos (não implementados)

### [P1-A] `Dockerfile` (novo, na raiz do projeto)

```dockerfile
# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --prefer-offline

COPY . .
RUN npm run build -- --configuration production

# ── Stage 2: serve ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=builder /app/dist/marluse-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

### [P1-A] `nginx.conf` (novo, na raiz do projeto)

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Compressão gzip
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # Cache longo para assets com hash no nome (ex: main-J4W57XXV.js)
    location ~* \.[0-9a-f]{8,}\.(js|css|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Sem cache para o index.html (sempre busca a versão mais recente)
    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    # Proxy reverso para o backend — Railway expõe a URL via variável de ambiente
    # Configure API_URL no painel do Railway (ex: https://marluse-backend.up.railway.app)
    location /api {
        proxy_pass ${API_URL};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA fallback — toda rota desconhecida serve o index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

> **Nota:** o nginx padrão não expande variáveis de ambiente em `proxy_pass` automaticamente.
> Há duas opções ao implementar:
> 1. Usar `envsubst` no CMD do Dockerfile para substituir `${API_URL}` antes de iniciar o nginx.
> 2. Ou fixar a URL do backend direto no `nginx.conf` (mais simples se o backend não muda de URL).

---

### [P1-B] `src/app/app.config.ts` — sem o APP_INITIALIZER

```typescript
import { ApplicationConfig, provideBrowserGlobalErrorListeners, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { provideNgxMask } from 'ngx-mask';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { MessageService } from 'primeng/api';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';

registerLocaleData(localePt);

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    MessageService,
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    provideNgxMask(),
    providePrimeNG({
      translation: {
        dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
        dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
        dayNamesMin: ['Do', 'Se', 'Te', 'Qa', 'Qi', 'Sx', 'Sa'],
        monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                     'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
        monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                          'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
        today: 'Hoje',
        clear: 'Limpar',
        weekHeader: 'Sem',
        firstDayOfWeek: 0,
        dateFormat: 'dd/mm/yy',
        weak: 'Fraco',
        medium: 'Médio',
        strong: 'Forte',
        passwordPrompt: 'Digite uma senha',
        emptyMessage: 'Nenhum resultado encontrado',
        emptyFilterMessage: 'Nenhum resultado encontrado',
      },
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.dark'
        }
      }
    }),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
  ]
}
```

---

### [P1-B] `src/app/core/guards/auth.guard.ts` — chama `me()` se ainda não autenticado

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, map, of } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Se já temos o usuário em memória (navegação interna), libera imediatamente
  if (auth.isAuthenticated()) {
    return true;
  }

  // Primeira visita / F5 — verifica a sessão com o backend
  return auth.me().pipe(
    map(() => true),
    catchError(() => {
      router.navigate(['/auth/login']);
      return of(false);
    })
  );
};
```

> **O que muda:** antes, o `APP_INITIALIZER` fazia esse `me()` bloqueando todo o bootstrap.
> Agora o app renderiza imediatamente e só o guard da rota protegida faz a chamada.
> Rotas públicas (`/auth/login`, `/auth/register`) não são afetadas.

---

### [P2-C] `src/index.html` — fontes otimizadas

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Marluse</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">

  <!-- Preconnect para reduzir latência de DNS/TLS das fontes -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <!-- Inter + Geist com display=swap (não bloqueia renderização) -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Geist:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>

  <!--
    Material Symbols: eixos fixos em vez de range completo.
    Antes: @20..48,100..700,0..1,-50..200  → arquivo enorme (eixos variáveis)
    Depois: @24,400,0,0                    → só o tamanho/peso que o app usa
  -->
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" rel="stylesheet"/>
</head>
<body>
  <app-root></app-root>
</body>
</html>
```
