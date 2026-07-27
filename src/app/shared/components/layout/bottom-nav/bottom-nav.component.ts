import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.component.html',
})
export class BottomNavComponent {
  items: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard',       route: '/dashboard'  },
    { label: 'Vendas',    icon: 'point_of_sale',   route: '/vendas'     },
    { label: 'Locações',  icon: 'calendar_month',  route: '/locacoes'   },
    { label: 'Financeiro',icon: 'trending_up',     route: '/financeiro' },
    { label: 'Clientes',  icon: 'group',           route: '/clientes'   },
  ];
}
