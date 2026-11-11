const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numeroFormatter = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 1,
});

const fechaFormatter = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Bogota',
});

const fechaHoraFormatter = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Bogota',
});

export function formatCOP(value: number): string {
  return copFormatter.format(value);
}

export function formatPeso(value: number): string {
  return `${numeroFormatter.format(value)} kg`;
}

export function formatNumero(value: number): string {
  return numeroFormatter.format(value);
}

export function formatFecha(iso: string): string {
  return fechaFormatter.format(new Date(iso)).replace(/\./g, '');
}

export function formatFechaHora(iso: string): string {
  return fechaHoraFormatter.format(new Date(iso)).replace(/\./g, '');
}

export function formatHoraCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Bogota',
  }).format(new Date(iso));
}
