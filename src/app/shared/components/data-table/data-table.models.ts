export type CellType = 'text' | 'currency' | 'currency-with-badge' | 'date' | 'mono' | 'tag' | 'computed';

export interface TableColumn {
  /** Campo do objeto (não usado em 'computed', mas útil como chave única) */
  field: string;
  header: string;
  width?: string;
  type?: CellType;

  /** Para type 'tag': retorna a severidade PrimeNG */
  tagSeverityFn?: (value: any, row?: any) => 'success' | 'warn' | 'danger' | 'secondary';

  /** Para type 'tag': retorna o texto do badge */
  tagLabelFn?: (value: any, row?: any) => string;

  /** Para type 'computed' ou 'mono': valor calculado a partir da linha */
  valueFn?: (row: any, index?: number) => string;

  /** Para type 'currency-with-badge': retorna o label do badge (ex: '-10%'), ou null para não exibir */
  badgeFn?: (row: any) => string | null;

  /** Aplica truncate ao conteúdo da célula */
  truncate?: boolean;

  /** Classe CSS extra aplicada ao <th> e <td> da coluna */
  cellClass?: string;

  /** Para type 'computed': classe CSS dependente da linha (ex.: vermelho para valores negativos) */
  cellClassFn?: (row: any) => string;
}

export interface TableActionConfig {
  /** Exibir botão de visualizar (padrão: true) */
  showView?: boolean;
  /** Exibir botão de ação secundária / editar (padrão: true) */
  showEdit?: boolean;
  /** Exibir botão de ação destrutiva / excluir (padrão: true) */
  showDelete?: boolean;

  /** Ícone do botão de visualizar (padrão: 'pi pi-eye') */
  viewIcon?: string;
  /** Tooltip do botão de visualizar (padrão: 'Visualizar') */
  viewTooltip?: string;

  /** Ícone do botão de editar (padrão: 'pi pi-pencil') */
  editIcon?: string;
  /** Tooltip do botão de editar (padrão: 'Editar') */
  editTooltip?: string;

  /** Ícone do botão de excluir (padrão: 'pi pi-trash') */
  deleteIcon?: string;
  /** Tooltip do botão de excluir (padrão: 'Excluir') */
  deleteTooltip?: string;

  /** Exibir botão de ação extra (padrão: false) */
  showExtra?: boolean;
  /** Ícone do botão extra (padrão: 'pi pi-pencil') */
  extraIcon?: string;
  /** Tooltip do botão extra (padrão: 'Editar') */
  extraTooltip?: string;

  /** Mensagem do confirm — recebe a linha como argumento */
  deleteMessageFn?: (row: any) => string;
  /** Cabeçalho do confirm */
  deleteHeader?: string;
  /** Texto do botão de aceitar no confirm (padrão: 'Excluir') */
  deleteAcceptLabel?: string;

  /** Exibir botão de apagar (exclusão permanente) */
  showApagar?: boolean;
  /** Ícone do botão apagar (padrão: 'pi pi-trash') */
  apagarIcon?: string;
  /** Tooltip do botão apagar (padrão: 'Apagar') */
  apagarTooltip?: string;
  /** Mensagem do confirm de apagar */
  apagarMessageFn?: (row: any) => string;
  /** Cabeçalho do confirm de apagar */
  apagarHeader?: string;
  /** Texto do botão aceitar no confirm de apagar */
  apagarAcceptLabel?: string;

  /** Exibir botão de exportar PDF */
  showExportPdf?: boolean;
  /** Exibir botão de imprimir térmica */
  showExportTermica?: boolean;
  /** Agrupa PDF e térmica em um menu de 3 pontos ao hover, em vez de botões separados */
  useExportMenu?: boolean;
}
