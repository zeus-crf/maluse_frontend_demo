import { Component, inject } from "@angular/core";
import { ExportService } from "../../services/export.service";
import { CommonModule, CurrencyPipe, DatePipe } from "@angular/common";

@Component({
  selector: 'app-locacao-comprovante',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe],
  templateUrl: './locacao-comprovante.component.html',
  styleUrl: './locacao-comprovante.component.scss'
})

export class LocacaoComprovanteComponent {

    get hoje(): Date { return new Date(); }

    exportService = inject(ExportService);
    locacao = this.exportService.locacao;
    formato = this.exportService.formato;

    formatarTelefone(tel: string | null): string {
        if (!tel) return '';
        const d = tel.replace(/\D/g, '');
        if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
        if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
        return tel;
    }

    descontoMonetario(): number {
        const l = this.locacao();
        if (!l || !l.desconto || l.desconto <= 0) return 0;
        return l.tipoDesconto === 'PERCENTUAL'
            ? l.valorBruto * l.desconto / 100
            : l.desconto;
    }

    jurosMonetario(): number {
        const l = this.locacao();
        if (!l || !l.juros || l.juros <= 0) return 0;
        const base = l.valorBruto - this.descontoMonetario();
        return l.tipoJuros === 'PERCENTUAL'
            ? base * l.juros / 100
            : l.juros;
    }
}