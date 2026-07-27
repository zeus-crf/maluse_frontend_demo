import { Component, input, output, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/services/auth.service';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

@Component({
  selector: 'app-mobile-drawer',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './mobile-drawer.component.html',
})
export class MobileDrawerComponent {
  open = input<boolean>(false);
  fechar = output<void>();

  private authService = inject(AuthService);
  private router = inject(Router);

  currentUser = this.authService.currentUser;
  initials    = this.authService.initials;

  menuGroups: MenuGroup[] = [
    {
      label: 'PRINCIPAL',
      items: [
        { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
      ]
    },
    {
      label: 'OPERAÇÕES',
      items: [
        { label: 'Vendas',   icon: 'point_of_sale',  route: '/vendas'   },
        { label: 'Locações', icon: 'calendar_month',  route: '/locacoes' },
        { label: 'Estoque',  icon: 'inventory_2',     route: '/estoque'  },
      ]
    },
    {
      label: 'GESTÃO',
      items: [
        { label: 'Clientes',   icon: 'group',       route: '/clientes'   },
        { label: 'Financeiro', icon: 'trending_up', route: '/financeiro' },
        { label: 'Relatórios', icon: 'assignment',  route: '/relatorios' },
      ]
    }
  ];

  navegarEFechar(route: string): void {
    this.router.navigate([route]);
    this.fechar.emit();
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => { this.fechar.emit(); this.router.navigate(['/auth/login']); },
      error: () => { this.fechar.emit(); this.router.navigate(['/auth/login']); }
    });
  }
}
