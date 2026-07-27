import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { EstoqueFiltroCompleto, UnidadeMedida } from '../models/estoque.models';

@Component({
  selector: 'app-estoque-filtros-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule],
  templateUrl: './estoque-filtros-modal.component.html',
})
export class EstoqueFiltrosModalComponent implements OnChanges {

  @Input() visible     = false;
  @Input() filtroAtual!: EstoqueFiltroCompleto;

  @Output() fechar  = new EventEmitter<void>();
  @Output() aplicar = new EventEmitter<EstoqueFiltroCompleto>();
  @Output() limpar  = new EventEmitter<void>();

  // Estado local
  medida:   UnidadeMedida | 'TODOS' = 'TODOS';
  minPreco: number | null = null;
  maxPreco: number | null = null;
  minQtd:   number | null = null;
  maxQtd:   number | null = null;

  readonly medidaOpcoes: { label: string; value: UnidadeMedida | 'TODOS' }[] = [
    { label: 'Todas',        value: 'TODOS'          },
    { label: 'Saco',         value: 'SACO'           },
    { label: 'Metro',        value: 'METRO'          },
    { label: 'Metro²',       value: 'METRO_QUADRADO' },
    { label: 'Litro',        value: 'LITRO'          },
    { label: 'Peça',         value: 'PECA'           },
    { label: 'Kg',           value: 'KG'             },
    { label: 'Rolo',         value: 'ROLO'           },
    { label: 'Balde',        value: 'BALDE'          },
  ];

  ngOnChanges(): void {
    if (this.visible && this.filtroAtual) {
      this.medida   = this.filtroAtual.medida;
      this.minPreco = this.filtroAtual.minPreco;
      this.maxPreco = this.filtroAtual.maxPreco;
      this.minQtd   = this.filtroAtual.minQtd;
      this.maxQtd   = this.filtroAtual.maxQtd;
    }
  }

  get temFiltroAtivo(): boolean {
    return this.medida   !== 'TODOS' ||
           this.minPreco !== null    ||
           this.maxPreco !== null    ||
           this.minQtd   !== null    ||
           this.maxQtd   !== null;
  }

  get contadorFiltros(): number {
    let n = 0;
    if (this.medida   !== 'TODOS') n++;
    if (this.minPreco !== null)    n++;
    if (this.maxPreco !== null)    n++;
    if (this.minQtd   !== null)    n++;
    if (this.maxQtd   !== null)    n++;
    return n;
  }

  onAplicar(): void {
    this.aplicar.emit({
      medida:   this.medida,
      minPreco: this.minPreco,
      maxPreco: this.maxPreco,
      minQtd:   this.minQtd,
      maxQtd:   this.maxQtd,
    });
  }

  onLimpar(): void {
    this.medida   = 'TODOS';
    this.minPreco = null;
    this.maxPreco = null;
    this.minQtd   = null;
    this.maxQtd   = null;
    this.limpar.emit();
  }
}
