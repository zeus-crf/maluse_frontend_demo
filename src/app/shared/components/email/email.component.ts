import { Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-email',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="relative w-full flex items-center">
      <span class="material-symbols-outlined absolute left-3 text-gray-400 text-[18px] pointer-events-none select-none">mail</span>
      <input
        type="email"
        [formControl]="control"
        placeholder="Endereço de E-mail"
        autocomplete="email"
        class="w-full pl-11 pr-4 py-3 text-sm border border-slate-200 rounded-xl bg-white text-gray-900 placeholder-gray-600 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      />
    </div>
  `,
  styles: [':host { display: block; width: 100%; }']
})
export class EmailComponent {
  @Input() control: FormControl = new FormControl('');
}
