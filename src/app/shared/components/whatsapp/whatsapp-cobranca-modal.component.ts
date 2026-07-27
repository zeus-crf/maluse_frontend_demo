import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';

@Component({
    selector: 'app-whatsapp-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, DialogModule],
    templateUrl: './whatsapp-cobranca-modal.component.html',
})
export class WhatsaapCobrancaModalComponent implements OnChanges {

    @Input() visible = false;
    @Input() clienteNome = '';
    @Input() telefone: string | null = null;
    @Input() mensagem = '';

    @Output() fechar = new EventEmitter<void>();

    mensagemEditavel = '';

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['mensagem']) {
            this.mensagemEditavel = this.mensagem;
        }
        if (changes['visible']?.currentValue === false) {
            this.mensagemEditavel = '';
        }
        if (changes['visible']?.currentValue === true) {
            this.mensagemEditavel = this.mensagem;
        }
    }

    get telefoneFormatado(): string {
        return this.telefone ?? 'Sem telefone cadastrado';
    }

    abrirWhatsApp(): void {
        if (!this.telefone) return;
        const digitos = this.telefone.replace(/\D/g, '');
        const url = `https://wa.me/55${digitos}?text=${encodeURIComponent(this.mensagemEditavel)}`;
        window.open(url, '_blank');
        this.fechar.emit();
    }

    fecharModal(): void {
        this.fechar.emit();
    }
}
