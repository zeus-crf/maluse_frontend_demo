import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SelectModule } from 'primeng/select';

export interface SelectSearchOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-select-search',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectSearchComponent),
      multi: true,
    },
  ],
  template: `
    <p-select
      [(ngModel)]="value"
      (ngModelChange)="onValueChange($event)"
      (onBlur)="onTouched()"
      [options]="options"
      optionLabel="label"
      optionValue="value"
      [filter]="true"
      filterBy="label"
      [checkmark]="true"
      [placeholder]="placeholder"
      [disabled]="disabled"
      [size]="size"
      emptyFilterMessage="Nenhum resultado"
      appendTo="body"
      styleClass="w-full" />
  `,
})
export class SelectSearchComponent implements ControlValueAccessor {
  @Input() options: SelectSearchOption[] = [];
  @Input() placeholder = 'Selecionar…';
  @Input() size: 'small' | 'large' | undefined = undefined;

  value = '';
  disabled = false;

  private onChange = (_: string) => {};
  onTouched = () => {};

  onValueChange(val: string): void {
    this.onChange(val);
  }

  writeValue(val: string): void {
    this.value = val ?? '';
  }

  registerOnChange(fn: (_: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }
}
