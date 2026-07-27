import { Component, inject } from '@angular/core';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';

/**
 * Componente global de diálogo de confirmação.
 *
 * Adicione `<app-confirm-dialog />` uma vez na raiz da página/feature.
 * Para acionar o diálogo injete `ConfirmationService` no componente chamador:
 *
 * ```ts
 * private confirmationService = inject(ConfirmationService);
 *
 * confirmar(event: Event) {
 *   this.confirmationService.confirm({
 *     target : event.target as EventTarget,
 *     message: 'Deseja excluir este registro?',
 *     header : 'Confirmar exclusão',
 *     icon   : 'pi pi-trash',
 *     acceptButtonProps: { severity: 'danger' },
 *     rejectButtonProps: { severity: 'secondary', outlined: true },
 *     accept : () => { ... },
 *     reject : () => { ... },
 *   });
 * }
 * ```
 *
 * Certifique-se de que `ConfirmationService` e `MessageService` estão
 * fornecidos no módulo/componente pai (ou via `providers` do componente).
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [ConfirmDialogModule, ToastModule],
  template: `
    <p-toast />
    <p-confirmdialog />
  `,
})
export class AppConfirmDialogComponent {}
