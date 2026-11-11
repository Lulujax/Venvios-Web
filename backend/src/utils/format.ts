const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const formatoFecha = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
});

export function formatCOP(value: number): string {
  return formatoCOP.format(value);
}

export function formatFecha(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return formatoFecha.format(date);
}

export function formatPeso(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)} kg`;
}
