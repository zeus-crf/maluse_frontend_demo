import { Injectable, signal } from "@angular/core";
import { PedidoResponse } from "../../features/vendas/models/vendas.models";
import { LocacaoResponse } from "../../features/locacoes/models/locacoes.models";

export type ExportFormato = 'pdf' | 'termica';
export type ExportTipo = 'pedido' | 'locacao';

@Injectable({ providedIn: 'root' })
export class ExportService {
    pedido = signal<PedidoResponse | null>(null);
    locacao = signal<LocacaoResponse | null>(null);
    formato = signal<ExportFormato | null>(null);
    
    
    private styleEl: HTMLStyleElement | null = null;


    imprimirPedido(pedido: PedidoResponse, formato: ExportFormato): void {
        this.pedido.set(pedido)
        this.locacao.set(null)
        this.formato.set(formato)
        setTimeout(() => this.print(formato), 100)
    }

    imprimirLocacao(locacao: LocacaoResponse, formato: ExportFormato): void {
        this.locacao.set(locacao);
        this.pedido.set(null);
        this.formato.set(formato);
        setTimeout(() => this.print(formato), 100)
    }

    private print(formato: ExportFormato): void {
        this.removerStyle();
        this.styleEl = document.createElement('style');
        // @page size: A4 para PDF; para térmica o usuário seleciona a impressora correta no diálogo
        const pageRule = formato === 'pdf'
            ? `@page { size: A4; margin: 15mm; }`
            : `@page { size: 80mm auto; margin: 3mm; }`;
        this.styleEl.textContent = pageRule;
        document.head.appendChild(this.styleEl);
        window.print();
        window.addEventListener('afterprint', () => {
        this.removerStyle();
        this.pedido.set(null);
        this.locacao.set(null);
        }, { once: true });
  }

  private removerStyle(): void {
    this.styleEl?.remove();
    this.styleEl = null;
  }
}