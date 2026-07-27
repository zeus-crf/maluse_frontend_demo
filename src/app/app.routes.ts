import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'auth/register',
    loadComponent: () =>
      import('./features/auth/register/register.component/register.component').then(m => m.RegisterComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/components/layout/layout/layout.component').then(m => m.LayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'vendas',
        loadComponent: () =>
          import('./features/vendas/vendas.component').then(m => m.VendasComponent)
      },
      {
        path: 'locacoes',
        loadComponent: () =>
          import('./features/locacoes/locacoes/locacoes.component').then(m => m.LocacoesComponent)
      },
      {
        path: 'estoque',
        loadComponent: () =>
          import('./features/estoque/estoque/estoque.component').then(m => m.EstoqueComponent)
      },
      {
        path: 'clientes',
        loadComponent: () =>
          import('./features/clientes/clientes/clientes.component').then(m => m.ClientesComponent)
      },
      {
        path: 'financeiro',
        loadComponent: () =>
          import('./features/financeiro/financeiro/financeiro.component').then(m => m.FinanceiroComponent)
      },

      {
        path: 'relatorios',
        loadComponent: () =>
          import('./features/relatorios/relatorios/relatorios.component').then(m => m.RelatoriosComponent)
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
