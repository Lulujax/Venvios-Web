export interface PartesBusqueda {
  texto: string;
  digitos: string;
}

export const MIN_DIGITOS_TELEFONO = 4;
export const LARGO_CODIGO_ENVIO = 6;

export function codigoDeConsolidacion(texto: string): string | null {
  const limpio = texto.toLowerCase().replace(/consolidaci[oó]n/g, '').replace(/[^a-z0-9]/g, '');
  return limpio.length === LARGO_CODIGO_ENVIO ? limpio : null;
}

export function idTerminaEnCodigo(id: string, codigo: string): boolean {
  return id.toLowerCase().replace(/[^a-z0-9]/g, '').endsWith(codigo);
}

export function partesBusqueda(entrada: string | undefined): PartesBusqueda | null {
  const texto = (entrada ?? '').trim().toLowerCase().slice(0, 80);
  if (!texto) return null;
  return { texto, digitos: texto.replace(/\D/g, '') };
}

export function coincideBusqueda(
  partes: PartesBusqueda,
  datos: { id?: string; nombre: string; codigo: string; telefono: string; trackings: string[]; guia: string | null },
): boolean {
  const { texto, digitos } = partes;
  const codigoEnvio = codigoDeConsolidacion(texto);
  if (codigoEnvio && datos.id && idTerminaEnCodigo(datos.id, codigoEnvio)) return true;
  if (datos.nombre.toLowerCase().includes(texto)) return true;
  if (datos.codigo.toLowerCase().includes(texto)) return true;
  if (digitos.length >= MIN_DIGITOS_TELEFONO && datos.telefono.includes(digitos)) return true;
  if (datos.trackings.some((t) => t.toLowerCase().includes(texto))) return true;
  return datos.guia?.toLowerCase().includes(texto) ?? false;
}
