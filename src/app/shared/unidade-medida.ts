/**
 * Unidades de medida contínuas, que podem ser vendidas/baixadas em quantidades
 * fracionadas (ex.: 1,5 m; 2,5 kg). As demais (SACO, PECA, ROLO) só aceitam
 * quantidades inteiras na interface.
 */
export const UNIDADES_FRACIONADAS = ['METRO', 'METRO_QUADRADO', 'LITRO', 'KG', 'BALDE'] as const;

/** Indica se a unidade permite quantidade com casas decimais. */
export function permiteQuantidadeFracionada(medida: string | null | undefined): boolean {
  return !!medida && (UNIDADES_FRACIONADAS as readonly string[]).includes(medida);
}
