import { Component, Input, Output, EventEmitter, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { NgxMaskDirective } from 'ngx-mask';
import { ClienteRequest, ClienteAtualizarRequest, ClienteResponse } from '../../models/clientes.models';
import { FieldErrorPipe } from '../../../../shared/pipes/field-error.pipe';
import { AppValidators } from '../../../../shared/validators/app-validators';

@Component({
  selector: 'app-novo-cliente-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DialogModule, NgxMaskDirective, FieldErrorPipe],
  templateUrl: './novo-cliente-modal.component.html',
})
export class NovoClienteModalComponent implements OnChanges {

  private fb = inject(FormBuilder);

  @Input() visible = false;
  @Input() clienteEdit: ClienteResponse | null = null;
  @Input() salvando = false;

  @Output() fechar = new EventEmitter<void>();
  @Output() salvar = new EventEmitter<ClienteRequest | ClienteAtualizarRequest>();

  consumidorFinal = true;

  form = this.fb.group({
    nome:     ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    cpfCnpj:  ['', [AppValidators.cpfValido()]],
    telefone: ['', [AppValidators.telefoneValido()]],
    email:    ['', [Validators.email, Validators.maxLength(100)]],
    endereco: ['', [Validators.maxLength(255)]],
  });

  get modoEdicao(): boolean { return this.clienteEdit !== null; }
  get titulo(): string { return this.modoEdicao ? 'Editar cliente' : 'Novo cliente'; }

  get maskCpfCnpj(): string {
    return this.consumidorFinal ? '000.000.000-00' : '00.000.000/0000-00';
  }

  ngOnChanges(): void {
    if (!this.visible) return;
    if (this.clienteEdit) {
      this.consumidorFinal = this.clienteEdit.consumidorFinal;
      this.atualizarValidadorCpfCnpj();
      this.form.reset({
        nome:     this.clienteEdit.nome,
        cpfCnpj:  this.clienteEdit.cpfCnpj  ?? '',
        telefone: this.clienteEdit.telefone  ?? '',
        email:    this.clienteEdit.email     ?? '',
        endereco: this.clienteEdit.endereco  ?? '',
      });
    } else {
      this.consumidorFinal = true;
      this.atualizarValidadorCpfCnpj();
      this.form.reset({ nome: '', cpfCnpj: '', telefone: '', email: '', endereco: '' });
    }
  }

  onTipoPessoaChange(pf: boolean): void {
    this.consumidorFinal = pf;
    this.form.get('cpfCnpj')?.reset('');
    this.atualizarValidadorCpfCnpj();
  }

  private atualizarValidadorCpfCnpj(): void {
    const ctrl = this.form.get('cpfCnpj')!;
    ctrl.setValidators(this.consumidorFinal ? [AppValidators.cpfValido()] : [AppValidators.cnpjValido()]);
    ctrl.updateValueAndValidity();
  }

  onSalvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const cpfCnpj  = v.cpfCnpj?.replace(/\D/g, '') || undefined;
    const telefone = v.telefone?.replace(/\D/g, '') || undefined;

    if (this.modoEdicao) {
      this.salvar.emit({
        nome:     v.nome!.trim(),
        cpfCnpj,
        telefone,
        email:    v.email    || undefined,
        endereco: v.endereco || undefined,
      } as ClienteAtualizarRequest);
    } else {
      this.salvar.emit({
        nome:            v.nome!.trim(),
        cpfCnpj,
        telefone,
        email:           v.email    || undefined,
        endereco:        v.endereco || undefined,
        consumidorFinal: this.consumidorFinal,
      } as ClienteRequest);
    }
  }

  onFechar(): void { this.fechar.emit(); }
}
