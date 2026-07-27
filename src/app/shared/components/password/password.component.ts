import { Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-senha',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="relative w-full flex items-center">
      <span class="material-symbols-outlined absolute left-3 text-gray-400 text-[18px] pointer-events-none select-none">lock</span>
      <input
        [type]="showPassword ? 'text' : 'password'"
        [formControl]="control"
        placeholder="Senha de Acesso"
        autocomplete="current-password"
        class="w-full pl-11 pr-11 py-3 text-sm border border-slate-200 rounded-xl bg-white text-gray-900 placeholder-gray-600 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      />
      <button type="button" (click)="showPassword = !showPassword"
        class="absolute right-3 text-gray-400 hover:text-gray-600 flex items-center p-0 bg-transparent border-none cursor-pointer">
        <span class="material-symbols-outlined text-[18px]">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
      </button>
    </div>
  `,
  styles: [':host { display: block; width: 100%; }']
})
export class SenhaComponent {
  @Input() control: FormControl = new FormControl('');
  showPassword = false;
}
