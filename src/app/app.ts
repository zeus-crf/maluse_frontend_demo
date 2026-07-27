import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PedidoComprovanteComponent } from './shared/components/pedido-comprovante/pedido.comprovante.component';
import { LocacaoComprovanteComponent } from './shared/components/locacao-comprovante/locacao.comprovante.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PedidoComprovanteComponent, LocacaoComprovanteComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('marluse-frontend');
}
