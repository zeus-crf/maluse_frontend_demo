import { Component, Input, DoCheck } from '@angular/core';
import { AbstractControl } from '@angular/forms';

@Component({
  selector: 'app-field-error',
  standalone: true,
  host: { style: 'display: block' },
  template: `
    @if (mostrar) {
      <span class="text-xs text-red-500 mt-0.5 flex items-center gap-1">
        <i class="pi pi-times-circle text-[10px]"></i>
        {{ mensagem }}
      </span>
    }
  `
})
export class FieldErrorComponent implements DoCheck {
  @Input() control: AbstractControl | null = null;

  mostrar  = false;
  mensagem = '';

  ngDoCheck(): void {
    const c = this.control;
    this.mostrar = !!(c && c.invalid && c.touched);
    if (!c?.errors) { this.mensagem = ''; return; }
    const e = c.errors;
    if (e['required'])            this.mensagem = 'Campo obrigatório';
    else if (e['email'])          this.mensagem = 'E-mail inválido';
    else if (e['minlength'])      this.mensagem = `Mínimo ${e['minlength'].requiredLength} caracteres`;
    else if (e['maxlength'])      this.mensagem = `Máximo ${e['maxlength'].requiredLength} caracteres`;
    else if (e['min'])            this.mensagem = `Valor mínimo: ${e['min'].min}`;
    else if (e['cpfInvalido'])    this.mensagem = 'CPF inválido';
    else if (e['cnpjInvalido'])   this.mensagem = 'CNPJ inválido';
    else if (e['telefoneInvalido']) this.mensagem = 'Telefone inválido';
    else                          this.mensagem = 'Campo inválido';
  }
}
