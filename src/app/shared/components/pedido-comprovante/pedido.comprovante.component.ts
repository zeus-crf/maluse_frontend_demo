import { Component, inject } from "@angular/core";
import { ExportService } from "../../services/export.service";
import { CommonModule, CurrencyPipe, DatePipe } from "@angular/common";

@Component({
  selector: 'app-pedido-comprovante',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe],
  templateUrl: './pedido-comprovante.component.html',
  styleUrl: './pedido-comprovante.component.scss'
})



export class PedidoComprovanteComponent {

    get hoje(): Date { return new Date(); }

    exportService = inject(ExportService);
    pedido  = this.exportService.pedido;
    formato = this.exportService.formato;

    formatarTelefone(tel: string | null): string {
        if (!tel) return '';
        const d = tel.replace(/\D/g, '');
        if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
        if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
        return tel;
    }

    descontoMonetario(): number {
        const p = this.pedido();
        if (!p || !p.desconto || p.desconto <= 0) return 0;
        return p.tipoDesconto === 'PERCENTUAL'
            ? p.valorBruto * p.desconto / 100
            : p.desconto;
    }

    jurosMonetario(): number {
        const p = this.pedido();
        if (!p || !p.juros || p.juros <= 0) return 0;
        const base = p.valorBruto - this.descontoMonetario();
        return p.tipoJuros === 'PERCENTUAL'
            ? base * p.juros / 100
            : p.juros;
    }
}