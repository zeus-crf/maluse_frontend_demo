import { Component, inject, computed, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { EmailComponent } from '../../../../shared/components/email/email.component';
import { SenhaComponent } from '../../../../shared/components/password/password.component';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, EmailComponent, SenhaComponent, ToastModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private messageService = inject(MessageService);

  form: FormGroup = this.fb.group({
    nome: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  loading = false;

  get passwordStrength(): number {
    const val: string = this.form.get('password')?.value ?? '';
    if (!val) return 0;
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
    if (/[0-9]/.test(val) && /[^a-zA-Z0-9]/.test(val)) score++;
    return Math.max(score, 1);
  }

  get strengthLabel(): string {
    return ['', 'Fraca', 'Razoável', 'Boa', 'Forte'][this.passwordStrength];
  }

  get strengthColor(): string {
    return ['', '#ef4444', '#f97316', '#3b82f6', '#22c55e'][this.passwordStrength];
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    const { nome, email, password } = this.form.value;

    this.authService.register(nome, email, password).subscribe({
      next: (res) => {
        this.loading = false;
        this.router.navigate(['/dashboard'], {
          state: { toast: { severity: 'success', summary: 'Conta criada!', detail: res.message } }
        });
      },
      error: (err) => {
        this.loading = false;
        const detail =
          err?.error?.message ||
          err?.error?.error ||
          'Erro ao criar conta. Tente novamente.';

        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail,
          life: 5000,
        });
      }
    });
  }

  get nome(): FormControl { return this.form.get('nome') as FormControl; }
  get email(): FormControl { return this.form.get('email') as FormControl; }
  get password(): FormControl { return this.form.get('password') as FormControl; }
}
