import { Component, Input, Output, EventEmitter, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { FieldErrorPipe } from '../../../../shared/pipes/field-error.pipe';
import {
  LancamentoFinanceiroResponse,
  LancamentoAtualizarRequest,
  TipoLancamento,
  StatusLancamento,
} from '../../models/financeiro.models';

@Component({
  selector: 'app-lancamento-edicao-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DialogModule, SelectComponent, DatePickerComponent, FieldErrorPipe],
  templateUrl: './lancamento-edicao-modal.component.html',
})
export class LancamentoEdicaoModalComponent implements OnChanges {

  private fb = inject(FormBuilder);

  readonly opcoesStatus = [
    { value: 'PENDENTE',  label: 'Pendente'  },
    { value: 'PAGO',      label: 'Pago'      },
    { value: 'CANCELADO', label: 'Cancelado' },
  ];

  @Input() visible    = false;
  @Input() salvando   = false;
  @Input() lancamento: LancamentoFinanceiroResponse | null = null;

  @Output() fechar = new EventEmitter<void>();
  @Output() salvar = new EventEmitter<LancamentoAtualizarRequest>();

  tipo: TipoLancamento = 'RECEITA';

  form = this.fb.group({
    descricao:      ['', [Validators.required, Validators.minLength(3), Validators.maxLength(512)]],
    categoria:      ['', [Validators.required, Validators.minLength(2)]],
    valor:          [null as number | null, [Validators.required, Validators.min(0.01)]],
    dataVencimento: ['', [Validators.required]],
    status:         ['PENDENTE' as StatusLancamento],
  });

  readonly categoriasSugeridas = [
    'Venda', 'Locação', 'Serviço', 'Aluguel', 'Salário',
    'Fornecedor', 'Utilidades', 'Imposto', 'Manutenção', 'Outro',
  ];

  ngOnChanges(): void {
    if (this.visible && this.lancamento) {
      this.tipo = this.lancamento.tipo;
      this.form.reset({
        descricao:      this.lancamento.descricao,
        categoria:      this.lancamento.categoria,
        valor:          this.lancamento.valor,
        dataVencimento: this.lancamento.dataVencimento,
        status:         this.lancamento.status === 'VENCIDO' ? 'PENDENTE' : this.lancamento.status,
      });
    }
  }

  setTipo(t: TipoLancamento): void { this.tipo = t; }

  onSalvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    this.salvar.emit({
      tipo:           this.tipo,
      descricao:      v.descricao!.trim(),
      categoria:      v.categoria!.trim(),
      valor:          v.valor!,
      dataVencimento: v.dataVencimento!,
      status:         v.status as StatusLancamento,
    });
  }

  onFechar(): void { this.fechar.emit(); }
}
