import { useState } from 'react';
import type { Paquete } from '../../types';
import { cn } from '../../lib/cn';
import { ETIQUETAS_ESTADO } from '../../lib/estados';
import { formatCOP, formatFechaHora, formatPeso } from '../../lib/format';
import { Icon } from '../ui/Icon';
import { StatusBadge } from '../ui/StatusBadge';

function PaqueteItem({ paquete }: { paquete: Paquete }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <article className="border border-line bg-white">
      <div className="grid gap-3 p-4 sm:grid-cols-12 sm:items-center sm:gap-4">
        <div className="sm:col-span-4">
          <p className="font-mono text-[12px] tracking-tight text-ink">{paquete.guia}</p>
          <p className="mt-1 line-clamp-1 text-[13px] text-muted">{paquete.descripcion}</p>
        </div>

        <div className="sm:col-span-3">
          <StatusBadge estado={paquete.estado} />
        </div>

        <div className="sm:col-span-2">
          <p className="meta">Peso cobrable</p>
          <p className="mt-0.5 font-mono text-[11px]">{formatPeso(paquete.pesoCobrable)}</p>
        </div>

        <div className="sm:col-span-2">
          <p className="meta">Costo</p>
          <p className="mt-0.5 font-mono text-[11px]">{formatCOP(paquete.precio)}</p>
        </div>

        <div className="flex justify-end sm:col-span-1">
          <button
            type="button"
            onClick={() => setAbierto((valor) => !valor)}
            aria-expanded={abierto}
            aria-label={abierto ? `Ocultar detalle de ${paquete.guia}` : `Ver detalle de ${paquete.guia}`}
            className="grid h-8 w-8 place-items-center border border-line transition-colors hover:border-ink"
          >
            <Icon
              name="chevronDown"
              size={16}
              className={cn('transition-transform duration-200', abierto && 'rotate-180')}
            />
          </button>
        </div>
      </div>

      {abierto && (
        <div className="grid gap-6 border-t border-line bg-paper px-4 py-5 sm:grid-cols-12">
          <div className="sm:col-span-4">
            {paquete.fotoUrl ? (
              <a href={paquete.fotoUrl} target="_blank" rel="noreferrer" className="block">
                <img
                  src={paquete.fotoUrl}
                  alt={`Evidencia fotográfica del paquete ${paquete.guia}`}
                  className="aspect-square w-full max-w-[180px] border border-line object-cover"
                  loading="lazy"
                />
                <span className="mt-2 inline-flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-muted">
                  Ver evidencia
                  <Icon name="arrowUpRight" size={11} />
                </span>
              </a>
            ) : (
              <div className="grid aspect-square w-full max-w-[180px] place-items-center border border-dashed border-ink/20 bg-white">
                <div className="text-center">
                  <Icon name="camera" size={22} className="mx-auto text-line" />
                  <p className="mt-2 px-3 font-mono text-[8px] uppercase leading-relaxed tracking-[0.1em] text-muted">
                    Foto pendiente en sede
                  </p>
                </div>
              </div>
            )}

            <dl className="mt-4 space-y-1.5 font-mono text-[10px]">
              <div className="flex justify-between gap-3">
                <dt className="uppercase tracking-[0.1em] text-muted">Peso real</dt>
                <dd>{formatPeso(paquete.pesoKg)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="uppercase tracking-[0.1em] text-muted">Registrado</dt>
                <dd>{formatFechaHora(paquete.createdAt)}</dd>
              </div>
            </dl>
          </div>

          <div className="sm:col-span-8">
            <p className="meta">Trazabilidad</p>
            <ol className="mt-3">
              {paquete.eventos.map((evento, index) => {
                const esUltimo = index === paquete.eventos.length - 1;
                return (
                  <li
                    key={`${evento.estado}-${evento.fecha}`}
                    className="relative border-b border-line pb-3 pl-6 last:border-b-0 last:pb-0"
                  >
                    <span
                      className={cn(
                        'absolute left-0 top-1 h-[9px] w-[9px] border',
                        esUltimo ? 'border-gold bg-gold' : 'border-ink/30 bg-white',
                      )}
                      aria-hidden="true"
                    />
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[12px] font-medium text-ink">
                        {ETIQUETAS_ESTADO[evento.estado]}
                      </p>
                      <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
                        {formatFechaHora(evento.fecha)}
                      </p>
                    </div>
                    {evento.nota && (
                      <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{evento.nota}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </article>
  );
}

export function PackageList({ paquetes, cargando }: { paquetes: Paquete[]; cargando: boolean }) {
  if (cargando) {
    return (
      <div className="mt-4 space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="border border-line bg-white p-4">
            <div className="h-3 w-40 bg-ink/[0.06]" />
            <div className="mt-3 h-2.5 w-2/3 bg-ink/[0.05]" />
          </div>
        ))}
      </div>
    );
  }

  if (paquetes.length === 0) {
    return (
      <div className="mt-4 border border-dashed border-ink/20 bg-white/60 p-8">
        <Icon name="package" size={24} className="text-line" />
        <p className="mt-3 text-sm font-medium">Aún no tienes paquetes registrados.</p>
        <p className="mt-1 max-w-[44ch] text-sm leading-relaxed text-muted">
          Cuando la sede reciba tu primera compra, aparecerá aquí con su guía, peso y estado.
        </p>
        <a
          href="#nueva-prealerta"
          className="link-underline mt-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-navy"
        >
          Registrar una prealerta
          <Icon name="arrowRight" size={13} />
        </a>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {paquetes.map((paquete) => (
        <PaqueteItem key={paquete.id} paquete={paquete} />
      ))}
    </div>
  );
}
