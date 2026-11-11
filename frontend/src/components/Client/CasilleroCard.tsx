import { useEffect, useState } from 'react';
import type { Casillero } from '../../types';
import { Icon } from '../ui/Icon';

export function CasilleroCard({ casillero }: { casillero: Casillero | null }) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const timeout = window.setTimeout(() => setCopiado(false), 2200);
    return () => window.clearTimeout(timeout);
  }, [copiado]);

  const copiar = async () => {
    if (!casillero) return;
    try {
      await navigator.clipboard.writeText(casillero.codigo);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  if (!casillero) {
    return (
      <div className="panel p-5">
        <p className="meta">Casillero</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Tu casillero aún no está asignado. Escríbenos por WhatsApp para completarlo.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-navy bg-white">
      <div className="flex items-center justify-between gap-3 bg-navy px-4 py-3 text-paper">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper/70">
          Tu casillero
        </p>
        <Icon name="barcode" size={17} className="text-gold" />
      </div>

      <div className="p-4">
        <p className="meta">Código único</p>
        <div className="mt-1 flex items-start justify-between gap-2">
          <p className="font-mono text-[21px] leading-tight tracking-tight text-navy">
            {casillero.codigo}
          </p>
          <button
            type="button"
            onClick={() => void copiar()}
            className="btn btn-outline btn-sm shrink-0"
            aria-live="polite"
          >
            <Icon name={copiado ? 'check' : 'copy'} size={12} />
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>

        <div className="barcode mt-4 text-navy" aria-hidden="true" />

        <div className="mt-4 border-t border-dashed border-ink/25 pt-3">
          <p className="meta">Dirección de recepción</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink">
            {casillero.direccion}
            <br />
            {casillero.ciudad}, Colombia
          </p>
          <p className="mt-2.5 font-mono text-[8px] uppercase leading-relaxed tracking-[0.1em] text-muted">
            Usa este código como referencia en todas tus compras.
          </p>
        </div>
      </div>
    </div>
  );
}
