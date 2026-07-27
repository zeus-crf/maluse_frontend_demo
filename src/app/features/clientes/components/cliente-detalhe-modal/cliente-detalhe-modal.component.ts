import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { ClienteResponse } from '../../models/clientes.models';

@Component({
  selector: 'app-cliente-detalhe-modal',
  standalone: true,
  imports: [CommonModule, DialogModule, TagModule],
  templateUrl: './cliente-detalhe-modal.component.html',
})
export class ClienteDetalheModalComponent {

  @Input() visible = false;
  @Input() cliente: ClienteResponse | null = null;

  @Output() fechar        = new EventEmitter<void>();
  @Output() editar        = new EventEmitter<ClienteResponse>();
  @Output() verHistorico  = new EventEmitter<ClienteResponse>();

  get tipo(): string {
    return this.cliente?.consumidorFinal ? 'Pessoa Física (PF)' : 'Pessoa Jurídica (PJ)';
  }

  get tipoSeverity(): 'success' | 'secondary' {
    return this.cliente?.consumidorFinal ? 'success' : 'secondary';
  }

  formatCurrency(v: number): string {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  onEditar(): void {
    if (this.cliente) this.editar.emit(this.cliente);
  }

  onVerHistorico(): void {
    if (this.cliente) this.verHistorico.emit(this.cliente);
  }

  onFechar(): void {
    this.fechar.emit();
  }
}
