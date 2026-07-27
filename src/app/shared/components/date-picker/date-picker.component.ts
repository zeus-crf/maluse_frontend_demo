import { Component, forwardRef, input, ViewEncapsulation, computed } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerModule],
  encapsulation: ViewEncapsulation.None,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true,
    },
  ],
  template: `
    <p-datepicker
      [(ngModel)]="innerDate"
      (ngModelChange)="onDateChange($event)"
      [placeholder]="placeholder()"
      [disabled]="isDisabled"
      dateFormat="dd/mm/yy"
      [showIcon]="true"
      icon="pi pi-calendar"
      [readonlyInput]="true"
      appendTo="body"
      [styleClass]="compact() ? 'w-full dp-compact' : 'w-full'"
      [inputStyleClass]="inputStyleClass()"
    />
  `,
  styles: [`
    /* Modo compacto: fonte e padding menores */
    .dp-compact input.p-datepicker-input {
      font-size: 0.75rem !important;
      padding: 0.25rem 0.5rem !important;
      line-height: 1.25rem !important;
    }
    .dp-compact .p-datepicker-calendar-button,
    .dp-compact .p-datepicker-button {
      width: 1.75rem !important;
      height: 1.75rem !important;
    }
  `],
})
export class DatePickerComponent implements ControlValueAccessor {
  placeholder = input('Selecione a data');
  compact     = input(false);

  inputStyleClass = computed(() =>
    this.compact()
      ? 'w-full px-2 py-1 border border-slate-200 rounded-lg outline-none focus:border-blue-400 text-gray-700'
      : 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 text-gray-700'
  );

  innerDate: Date | null = null;
  isDisabled = false;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  onDateChange(date: Date | null): void {
    this.onTouched();
    if (!date) {
      this.onChange('');
      return;
    }
    const yyyy = date.getFullYear();
    const mm   = String(date.getMonth() + 1).padStart(2, '0');
    const dd   = String(date.getDate()).padStart(2, '0');
    this.onChange(`${yyyy}-${mm}-${dd}`);
  }

  writeValue(value: string | null): void {
    if (!value) {
      this.innerDate = null;
      return;
    }
    const [yyyy, mm, dd] = value.split('-').map(Number);
    this.innerDate = new Date(yyyy, mm - 1, dd);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }
}
