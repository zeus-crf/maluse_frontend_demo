import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { BottomNavComponent } from '../bottom-nav/bottom-nav.component';
import { MobileDrawerComponent } from '../mobile-drawer/mobile-drawer.component';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, BottomNavComponent, MobileDrawerComponent, ToastModule],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  drawerOpen = signal(false);

  abrirDrawer(): void { this.drawerOpen.set(true); }
  fecharDrawer(): void { this.drawerOpen.set(false); }
}
