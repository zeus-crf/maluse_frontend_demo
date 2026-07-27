import { Pipe, PipeTransform } from '@angular/core';
import { AbstractControl } from '@angular/forms';

/** Impure: re-evaluated on every CD cycle — intentional. */
@Pipe({ name: 'fieldError', standalone: true, pure: false })
export class FieldErrorPipe implements PipeTransform {
  transform(control: AbstractControl | null | undefined): string {
    if (!control || !control.invalid || !control.touched) return '';
    const e = control.errors!;
    if (e['required'])              return 'Campo obrigatório';
    if (e['email'])                 return 'E-mail inválido';
    if (e['minlength'])             return `Mínimo ${e['minlength'].requiredLength} caracteres`;
    if (e['maxlength'])             return `Máximo ${e['maxlength'].requiredLength} caracteres`;
    if (e['min'])                   return `Valor mínimo: ${e['min'].min}`;
    if (e['cpfInvalido'])           return 'CPF inválido';
    if (e['cnpjInvalido'])          return 'CNPJ inválido';
    if (e['telefoneInvalido'])      return 'Telefone inválido';
    return 'Campo inválido';
  }
}
