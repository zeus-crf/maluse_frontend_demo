import { Component, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { EmailComponent } from '../../../shared/components/email/email.component';
import { SenhaComponent } from '../../../shared/components/password/password.component';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, EmailComponent, SenhaComponent, ToastModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private messageService = inject(MessageService);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  loading = false;

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    const { email, password } = this.form.value;

    this.authService.login(email, password).subscribe({
      next: (res) => {
        this.loading = false;
        this.router.navigate(['/dashboard'], {
          state: { toast: { severity: 'success', summary: 'Sucesso', detail: res.message } }
        });
      },
      error: (err) => {
        this.loading = false;

        // Tenta pegar a mensagem do backend, com fallbacks
        const detail =
          err?.error?.message ||
          err?.error?.error ||
          (err.status === 401 || err.status === 403 ? 'E-mail ou senha inválidos.' : 'Erro ao conectar. Tente novamente.');

        this.messageService.add({
          severity: 'error',
          summary: 'Erro ao entrar',
          detail,
          life: 5000,
        });
      },
    });
  }

  get email(): FormControl {
    return this.form.get('email') as FormControl;
  }

  get password(): FormControl {
    return this.form.get('password') as FormControl;
  }
}
