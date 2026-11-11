import { cn } from '../../lib/cn';
import { ETIQUETAS_ESTADO, ETIQUETAS_PREALERTA } from '../../lib/estados';
import type { EstadoPaquete, EstadoPrealerta } from '../../types';

const TONOS: Record<EstadoPaquete, { clase: string; punto: string }> = {
  RECIBIDO: { clase: 'border-line bg-paper text-ink', punto: 'bg-gold' },
  EN_BODEGA: { clase: 'border-navy/25 bg-navy/[0.04] text-navy', punto: 'bg-navy' },
  EN_TRANSITO: { clase: 'border-navy bg-navy text-paper', punto: 'bg-gold' },
  EN_ADUANA: { clase: 'border-gold/60 bg-gold/10 text-ink', punto: 'bg-gold' },
  ENTREGADO: { clase: 'border-navy/40 bg-white text-navy', punto: 'bg-navy' },
  CANCELADO: { clase: 'border-red/40 bg-red/[0.04] text-red', punto: 'bg-red' },
};

const TONOS_PREALERTA: Record<EstadoPrealerta, { clase: string; punto: string }> = {
  PENDIENTE: { clase: 'border-gold/60 bg-gold/10 text-ink', punto: 'bg-gold' },
  RECIBIDA: { clase: 'border-navy/30 bg-navy/[0.04] text-navy', punto: 'bg-navy' },
  CANCELADA: { clase: 'border-red/40 bg-red/[0.04] text-red', punto: 'bg-red' },
};

export function StatusBadge({ estado }: { estado: EstadoPaquete }) {
  const tono = TONOS[estado];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em]',
        tono.clase,
      )}
    >
      <span className={cn('h-1.5 w-1.5', tono.punto)} aria-hidden="true" />
      {ETIQUETAS_ESTADO[estado]}
    </span>
  );
}

export function PrealertaBadge({ estado }: { estado: EstadoPrealerta }) {
  const tono = TONOS_PREALERTA[estado];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em]',
        tono.clase,
      )}
    >
      <span className={cn('h-1.5 w-1.5', tono.punto)} aria-hidden="true" />
      {ETIQUETAS_PREALERTA[estado]}
    </span>
  );
}
