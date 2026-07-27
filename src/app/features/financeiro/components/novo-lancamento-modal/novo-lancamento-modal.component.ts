import { Component, Input, Output, EventEmitter, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import {
  LancamentoFinanceiroRequest,
  TipoLancamento,
  StatusLancamento,
  Recorrencia,
} from '../../models/financeiro.models';
import { ClienteSimples } from '../../../vendas/models/vendas.models';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { SelectSearchComponent } from '../../../../shared/components/select-search/select-search.component';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { FieldErrorPipe } from '../../../../shared/pipes/field-error.pipe';

@Component({
  selector: 'app-novo-lancamento-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DialogModule, SelectComponent, SelectSearchComponent, DatePickerComponent, FieldErrorPipe],
  templateUrl: './novo-lancamento-modal.component.html',
})
export class NovoLancamentoModalComponent implements OnChanges {

  private fb = inject(FormBuilder);

  @Input() visible  = false;
  @Input() salvando = false;
  @Input() clientes: ClienteSimples[] = [];

  @Output() fechar           = new EventEmitter<void>();
  @Output() lancamentoCriado = new EventEmitter<LancamentoFinanceiroRequest>();

  tipo: TipoLancamento = 'RECEITA';
  recorrente = false;
  recorrencia: Recorrencia = 'MENSAL';

  form = this.fb.group({
    descricao:      ['', [Validators.required, Validators.minLength(3), Validators.maxLength(512)]],
    categoria:      ['', [Validators.required, Validators.minLength(2)]],
    valor:          [null as number | null, [Validators.required, Validators.min(0.01)]],
    dataVencimento: ['', [Validators.required]],
    status:         ['PENDENTE' as StatusLancamento],
    clienteId:      [null as string | null],
  });

  readonly categoriasSugeridas = [
    'Venda', 'Locação', 'Serviço', 'Aluguel', 'Salário',
    'Fornecedor', 'Utilidades', 'Imposto', 'Manutenção', 'Outro',
  ];

  readonly recorrencias: { label: string; value: Recorrencia }[] = [
    { label: 'Diária',  value: 'DIARIA'  },
    { label: 'Semanal', value: 'SEMANAL' },
    { label: 'Mensal',  value: 'MENSAL'  },
    { label: 'Anual',   value: 'ANUAL'   },
  ];

  readonly opcoesStatus = [
    { value: 'PENDENTE', label: 'Pendente' },
    { value: 'PAGO',     label: 'Pago'     },
  ];

  get clienteOptions() {
    return [
      { value: '', label: '— Nenhum —' },
      ...this.clientes.map(c => ({ value: c.id, label: c.nome })),
    ];
  }

  ngOnChanges(): void {
    if (this.visible) this.resetar();
  }

  setTipo(t: TipoLancamento): void { this.tipo = t; }

  onSalvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    this.lancamentoCriado.emit({
      tipo:           this.tipo,
      descricao:      v.descricao!.trim(),
      categoria:      v.categoria!.trim(),
      valor:          v.valor!,
      dataVencimento: v.dataVencimento!,
      status:         v.status as StatusLancamento,
      clienteId:      v.clienteId || null,
      recorrencia:    this.recorrente ? this.recorrencia : null,
    });
  }

  onFechar(): void { this.fechar.emit(); }

  private resetar(): void {
    this.tipo        = 'RECEITA';
    this.recorrente  = false;
    this.recorrencia = 'MENSAL';
    this.form.reset({
      descricao:      '',
      categoria:      '',
      valor:          null,
      dataVencimento: new Date().toISOString().split('T')[0],
      status:         'PENDENTE',
      clienteId:      null,
    });
  }
}
