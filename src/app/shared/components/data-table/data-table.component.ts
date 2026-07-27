import { Component, Input, Output, EventEmitter, inject, HostListener, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { TableColumn, TableActionConfig } from './data-table.models';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, TagModule, ButtonModule, RippleModule, TooltipModule, ConfirmDialogModule],
  templateUrl: './data-table.component.html',
  providers: [ConfirmationService],
})
export class DataTableComponent implements OnDestroy {

  private confirmationService = inject(ConfirmationService);

  ngOnDestroy(): void {
    this._removeScrollListener();
  }

  /** Definição das colunas */
  @Input() columns: TableColumn[] = [];

  /** Dados da tabela */
  @Input() rows: any[] = [];

  @Input() loading = false;

  /** Mensagem exibida quando não há dados */
  @Input() emptyMessage = 'Nenhum registro encontrado';

  /** Número de linhas por página */
  @Input() pageSize = 10;

  /** Ativa scroll interno da tabela (modo flex — tabela preenche altura disponível) */
  @Input() scrollable = false;
  @Input() scrollHeight = 'flex';

  /** Exibe o input de busca acima da tabela */
  @Input() searchable = true;

  /** Placeholder do input de busca */
  @Input() searchPlaceholder = 'Buscar...';

  /** Exibe o botão de filtro ao lado da busca */
  @Input() showFiltrar = false;

  /** Indica se há filtro ativo (mostra ponto azul no botão) */
  @Input() filtroAtivo = false;

  /** Emitido ao clicar no botão de filtro */
  @Output() filtrar = new EventEmitter<void>();

  /** Termo de busca interno */
  busca = '';

  get rowsFiltrados(): any[] {
    if (!this.busca.trim()) return this.rows;
    const termo = this.normalizar(this.busca.trim());
    return this.rows.filter((row, i) =>
      this.columns.some(col => {
        const val = this.getCellValue(col, row, i);
        return val != null && this.normalizar(String(val)).includes(termo);
      })
    );
  }

  private normalizar(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  /** Configuração dos botões de ação */
  @Input() actions: TableActionConfig = {
    showView:   true,
    showEdit:   true,
    showDelete: true,
    deleteHeader: 'Confirmar exclusão',
  };

  // ── Menu de exportação (clique) ───────────────────────────
  // Signals: escrever num signal notifica o change detection do app zoneless
  // (sem zone.js), mesmo a partir de um listener nativo de scroll.
  exportMenuVisible = signal(false);
  exportMenuX = signal(0);
  exportMenuY = signal(0);
  exportMenuRow = signal<any>(null);

  /** Alvos onde o listener de scroll foi anexado (para remover depois) */
  private _scrollTargets: EventTarget[] = [];

  /** Fecha o menu ao rolar qualquer container/janela */
  private _onScroll = (): void => {
    if (!this.exportMenuVisible()) return;
    this.closeExportMenu();
  };

  /** Abre/fecha o menu ao clicar nos 3 pontos */
  toggleExportMenu(event: MouseEvent, row: any): void {
    event.stopPropagation();
    const btn = event.currentTarget as HTMLElement;
    // Se já está aberto para esta linha, fecha
    if (this.exportMenuVisible() && this.exportMenuRow() === row) {
      this.closeExportMenu();
      return;
    }
    const rect = btn.getBoundingClientRect();
    this.exportMenuRow.set(row);
    this.exportMenuX.set(rect.right - 140);
    this.exportMenuY.set(rect.bottom + 4);
    this.exportMenuVisible.set(true);
    this._attachScrollListeners(btn);
  }

  closeExportMenu(): void {
    this.exportMenuVisible.set(false);
    this._removeScrollListener();
  }

  /**
   * Anexa o listener de scroll na janela e em TODO ancestral que rola.
   * Fazer isso nos containers reais garante que o evento seja capturado
   * (scroll não borbulha; a captura na window pode não bastar em todos os casos).
   */
  private _attachScrollListeners(el: HTMLElement): void {
    this._removeScrollListener();
    const targets: EventTarget[] = [window];
    let node: HTMLElement | null = el.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      const style = getComputedStyle(node);
      const overflow = style.overflowY + style.overflowX;
      if (/(auto|scroll|overlay)/.test(overflow)) {
        targets.push(node);
      }
      node = node.parentElement;
    }
    for (const t of targets) {
      t.addEventListener('scroll', this._onScroll, { passive: true, capture: true });
    }
    this._scrollTargets = targets;
  }

  private _removeScrollListener(): void {
    for (const t of this._scrollTargets) {
      t.removeEventListener('scroll', this._onScroll, { capture: true } as any);
    }
    this._scrollTargets = [];
  }

  /** Fecha ao clicar em qualquer lugar fora do menu */
  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.exportMenuVisible()) this.closeExportMenu();
  }
  // ──────────────────────────────────────────────────────────

  

  @Output() verDetalhe    = new EventEmitter<unknown>();
  @Output() editar        = new EventEmitter<unknown>();
  @Output() excluir       = new EventEmitter<unknown>();
  @Output() extra         = new EventEmitter<unknown>();
  @Output() apagar        = new EventEmitter<unknown>();
  @Output() exportPdf     = new EventEmitter<unknown>();
  @Output() exportTermica = new EventEmitter<unknown>();

  get showActions(): boolean {
    return !!(this.actions.showView || this.actions.showEdit || this.actions.showDelete || this.actions.showExtra || this.actions.showApagar || this.actions.showExportPdf || this.actions.showExportTermica || this.actions.useExportMenu);
  }

  /** Total de colunas + coluna de ações (se existir) */
  get totalCols(): number {
    return this.columns.length + (this.showActions ? 1 : 0);
  }

  get viewIcon():   string { return this.actions.viewIcon   ?? 'pi pi-eye'; }
  get viewTooltip():string { return this.actions.viewTooltip ?? 'Visualizar'; }
  get editIcon():   string { return this.actions.editIcon   ?? 'pi pi-pencil'; }
  get editTooltip():string { return this.actions.editTooltip ?? 'Editar'; }
  get deleteIcon(): string { return this.actions.deleteIcon  ?? 'pi pi-trash'; }
  get deleteTooltip():string { return this.actions.deleteTooltip ?? 'Excluir'; }
  get extraIcon():   string { return this.actions.extraIcon    ?? 'pi pi-pencil'; }
  get extraTooltip():string { return this.actions.extraTooltip ?? 'Editar'; }
  get apagarIcon():  string { return this.actions.apagarIcon   ?? 'pi pi-trash'; }
  get apagarTooltip():string{ return this.actions.apagarTooltip ?? 'Apagar'; }

  confirmarExclusao(row: any): void {
    const message = this.actions.deleteMessageFn
      ? this.actions.deleteMessageFn(row)
      : 'Deseja excluir este registro?';

    this.confirmationService.confirm({
      message,
      header:       this.actions.deleteHeader      ?? 'Confirmar exclusão',
      icon:         this.actions.deleteIcon        ?? 'pi pi-trash',
      acceptLabel:  this.actions.deleteAcceptLabel ?? 'Confirmar',
      rejectLabel:  'Cancelar',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.excluir.emit(row),
    });
  }

  confirmarApagar(row: any): void {
    const message = this.actions.apagarMessageFn
      ? this.actions.apagarMessageFn(row)
      : 'Esta ação é permanente e não pode ser desfeita. Confirma?';

    this.confirmationService.confirm({
      message,
      header:       this.actions.apagarHeader      ?? 'Apagar permanentemente',
      icon:         'pi pi-exclamation-triangle',
      acceptLabel:  this.actions.apagarAcceptLabel ?? 'Apagar',
      rejectLabel:  'Cancelar',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.apagar.emit(row),
    });
  }

  // ── Helpers de célula ──────────────────────────────────────

  getCellValue(col: TableColumn, row: any, index: number): any {
    if (col.valueFn) return col.valueFn(row, index);
    return row[col.field];
  }

  formatCurrency(v: number): string {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatDate(iso: string | Date): string {
    if (!iso) return '—';
    let d: Date;
    if (typeof iso === 'string') {
      // Se já tem hora (contém 'T'), usa direto; senão força meia-noite local
      d = iso.includes('T') ? new Date(iso) : new Date(iso + 'T00:00:00');
    } else {
      d = iso;
    }
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR');
  }
}
