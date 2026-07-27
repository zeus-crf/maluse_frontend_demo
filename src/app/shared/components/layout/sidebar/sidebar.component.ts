import { Component, signal, inject, HostListener, OnInit } from '@angular/core';
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
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router)

  currentUser = this.authService.currentUser;
  initials    = this.authService.initials;

  collapsed = signal<boolean>(localStorage.getItem('sidebar-collapsed') === 'true');

  private get isTablet(): boolean {
    return window.innerWidth >= 768 && window.innerWidth < 1024;
  }

  ngOnInit(): void {
    this.applyBreakpoint();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.applyBreakpoint();
  }

  private applyBreakpoint(): void {
    if (this.isTablet) {
      this.collapsed.set(true);
    } else if (window.innerWidth >= 1024) {
      this.collapsed.set(localStorage.getItem('sidebar-collapsed') === 'true');
    }
  }

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
        { label: 'Vendas',   icon: 'point_of_sale', route: '/vendas' },
        { label: 'Locações', icon: 'calendar_month', route: '/locacoes' },
        { label: 'Estoque',  icon: 'inventory_2',   route: '/estoque' },
      ]
    },
    {
      label: 'GESTÃO',
      items: [
        { label: 'Clientes',   icon: 'group',                  route: '/clientes' },
        { label: 'Financeiro', icon: 'trending_up',            route: '/financeiro' },
        { label: 'Relatórios', icon: 'assignment',             route: '/relatorios' },
      ]
    }
  ];

  toggle(): void {
    this.collapsed.update(v => {
      localStorage.setItem('sidebar-collapsed', String(!v));
      return !v;
    });
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/auth/login']),
      error: () => this.router.navigate(['/auth/login'])
    });
  }
}
