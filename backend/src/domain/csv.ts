const SEPARADOR = ';';
const MARCA_UTF8 = '﻿';
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;

export type CeldaCsv = string | number | boolean | null | undefined;

export function celdaCsv(valor: CeldaCsv): string {
  if (valor === null || valor === undefined) return '';
  const texto = typeof valor === 'boolean' ? (valor ? 'Sí' : 'No') : String(valor);
  const protegido = typeof valor === 'string' && INICIO_DE_FORMULA.test(texto) ? `'${texto}` : texto;
  if (/[";\n\r]/.test(protegido)) return `"${protegido.replace(/"/g, '""')}"`;
  return protegido;
}

export function aCsv(encabezados: string[], filas: CeldaCsv[][]): string {
  if (encabezados.length === 0) throw new Error('El CSV necesita al menos una columna.');
  for (const fila of filas) {
    if (fila.length !== encabezados.length) throw new Error('Una fila del CSV no tiene el mismo número de columnas que el encabezado.');
  }
  const lineas = [encabezados, ...filas].map((fila) => fila.map((celda) => celdaCsv(celda)).join(SEPARADOR));
  return MARCA_UTF8 + lineas.join('\r\n') + '\r\n';
}

export function dineroCsv(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return '';
  return (centavos / 100).toFixed(2).replace('.', ',');
}

export function fechaCsv(fecha: Date | string | null | undefined): string {
  if (!fecha) return '';
  const valor = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(valor.getTime())) return '';
  return valor.toISOString().slice(0, 16).replace('T', ' ');
}
