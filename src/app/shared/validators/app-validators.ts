import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export class AppValidators {

  /** CPF: exatamente 11 dígitos numéricos (ignora máscara) */
  static cpfValido(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor = (control.value ?? '').replace(/\D/g, '');
      if (!valor) return null; // campo opcional — só valida se preenchido
      return valor.length === 11 ? null : { cpfInvalido: true };
    };
  }

  /** CNPJ: exatamente 14 dígitos numéricos (ignora máscara) */
  static cnpjValido(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor = (control.value ?? '').replace(/\D/g, '');
      if (!valor) return null;
      return valor.length === 14 ? null : { cnpjInvalido: true };
    };
  }

  /** Telefone: entre 10 e 11 dígitos numéricos (ignora máscara) */
  static telefoneValido(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor = (control.value ?? '').replace(/\D/g, '');
      if (!valor) return null;
      return valor.length >= 10 && valor.length <= 11 ? null : { telefoneInvalido: true };
    };
  }
}
