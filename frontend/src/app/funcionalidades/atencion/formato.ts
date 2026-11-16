/** Los campos numéricos se escriben con coma decimal ("12,4"), como se ve en el Figma. */
export function aNumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (!limpio) {
    return null;
  }
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

export function aTexto(numero: number | null | undefined): string {
  return numero === null || numero === undefined ? '' : String(numero).replace('.', ',');
}

/** Suma días a una fecha ISO (aaaa-mm-dd) sin pasar por zonas horarias. */
export function sumarDias(fechaIso: string, dias: number): string {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return fecha.toISOString().slice(0, 10);
}

export function hoyIso(): string {
  const ahora = new Date();
  const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
