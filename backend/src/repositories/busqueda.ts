export interface PartesBusqueda {
  texto: string;
  digitos: string;
}

export const MIN_DIGITOS_TELEFONO = 4;

export function partesBusqueda(entrada: string | undefined): PartesBusqueda | null {
  const texto = (entrada ?? '').trim().toLowerCase().slice(0, 80);
  if (!texto) return null;
  return { texto, digitos: texto.replace(/\D/g, '') };
}

export function coincideBusqueda(
  partes: PartesBusqueda,
  datos: { nombre: string; codigo: string; telefono: string; trackings: string[]; guia: string | null },
): boolean {
  const { texto, digitos } = partes;
  if (datos.nombre.toLowerCase().includes(texto)) return true;
  if (datos.codigo.toLowerCase().includes(texto)) return true;
  if (digitos.length >= MIN_DIGITOS_TELEFONO && datos.telefono.includes(digitos)) return true;
  if (datos.trackings.some((t) => t.toLowerCase().includes(texto))) return true;
  return datos.guia?.toLowerCase().includes(texto) ?? false;
}
