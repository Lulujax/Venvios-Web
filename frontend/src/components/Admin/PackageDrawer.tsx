import { useEffect, useState } from 'react';
import type { EstadoPaquete, Paquete } from '../../types';
import { api, ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import { ETIQUETAS_ESTADO } from '../../lib/estados';
import { formatCOP, formatFechaHora, formatPeso } from '../../lib/format';
import { Icon } from '../ui/Icon';
import { StatusBadge } from '../ui/StatusBadge';

interface PackageDrawerProps {
  paquete: Paquete | null;
  onCerrar: () => void;
  onActualizado: (paquete: Paquete) => void;
}

export function PackageDrawer({ paquete, onCerrar, onActualizado }: PackageDrawerProps) {
  const [nota, setNota] = useState('');
  const [actualizando, setActualizando] = useState<EstadoPaquete | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNota('');
    setError(null);
    setActualizando(null);
  }, [paquete?.id]);

  useEffect(() => {
    if (!paquete) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [paquete, onCerrar]);

  if (!paquete) return null;

  const cambiarEstado = async (estado: EstadoPaquete) => {
    setActualizando(estado);
    setError(null);
    try {
      const data = await api.patch<{ paquete: Paquete }>(
        `/admin/paquetes/${paquete.id}/estado`,
        { estado, nota: nota.trim() || undefined },
      );
      setNota('');
      onActualizado(data.paquete);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No pudimos actualizar el estado del paquete.',
      );
    } finally {
      setActualizando(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-navy/45"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-titulo"
      onClick={onCerrar}
    >
      <div
        className="flex h-full w-full max-w-[480px] flex-col overflow-y-auto border-l border-ink/20 bg-paper"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-white px-5 py-4">
          <div>
            <p className="meta">Detalle de paquete</p>
            <h2 id="drawer-titulo" className="mt-1 font-mono text-[17px] tracking-tight">
              {paquete.guia}
            </h2>
            <div className="mt-2">
              <StatusBadge estado={paquete.estado} />
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="grid h-9 w-9 shrink-0 place-items-center border border-line hover:border-ink"
            aria-label="Cerrar detalle"
          >
            <Icon name="close" size={17} />
          </button>
        </header>

        <div className="space-y-5 p-5">
          <section className="border border-line bg-white">
            <div className="border-b border-line px-4 py-2.5">
              <p className="eyebrow">Cliente</p>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{paquete.cliente?.nombre ?? 'Sin cliente'}</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                  {paquete.cliente?.casillero ?? 'Sin casillero'}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 border border-navy/20 bg-navy/[0.04] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-navy">
                <Icon name="lock" size={10} />
                Contacto restringido
              </span>
            </div>
          </section>

          <section className="border border-line bg-white">
            <div className="border-b border-line px-4 py-2.5">
              <p className="eyebrow">Carga</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm leading-relaxed text-ink">{paquete.descripcion}</p>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <dt className="meta">Peso real</dt>
                  <dd className="mt-0.5 font-mono text-[12px]">{formatPeso(paquete.pesoKg)}</dd>
                </div>
                <div>
                  <dt className="meta">Peso cobrable</dt>
                  <dd className="mt-0.5 font-mono text-[12px]">
                    {formatPeso(paquete.pesoCobrable)}
                  </dd>
                </div>
                <div>
                  <dt className="meta">Costo calculado</dt>
                  <dd className="mt-0.5 font-mono text-[12px]">{formatCOP(paquete.precio)}</dd>
                </div>
                <div>
                  <dt className="meta">Registrado</dt>
                  <dd className="mt-0.5 font-mono text-[11px]">
                    {formatFechaHora(paquete.createdAt)}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <p className="eyebrow">Evidencia</p>
              {paquete.fotoUrl && (
                <a
                  href={paquete.fotoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="footer-link font-mono text-[8px] uppercase tracking-[0.1em] text-navy"
                >
                  Abrir original
                </a>
              )}
            </div>
            <div className="p-4">
              {paquete.fotoUrl ? (
                <img
                  src={paquete.fotoUrl}
                  alt={`Evidencia del paquete ${paquete.guia}`}
                  className="max-h-[220px] w-full border border-line object-cover"
                />
              ) : (
                <div className="grid h-28 place-items-center border border-dashed border-ink/20 bg-paper">
                  <div className="text-center">
                    <Icon name="camera" size={20} className="mx-auto text-line" />
                    <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.1em] text-muted">
                      Sin foto. Usa el escáner para capturarla.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="border border-line bg-white">
            <div className="border-b border-line px-4 py-2.5">
              <p className="eyebrow">Trazabilidad</p>
            </div>
            <ol className="px-4 py-3">
              {paquete.eventos.map((evento, index) => (
                <li
                  key={`${evento.estado}-${evento.fecha}`}
                  className="relative border-b border-line pb-3 pl-5 last:border-b-0 last:pb-0"
                >
                  <span
                    className={cn(
                      'absolute left-0 top-1 h-2 w-2 border',
                      index === paquete.eventos.length - 1
                        ? 'border-gold bg-gold'
                        : 'border-ink/30 bg-white',
                    )}
                    aria-hidden="true"
                  />
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[12px] font-medium">{ETIQUETAS_ESTADO[evento.estado]}</p>
                    <p className="font-mono text-[8px] uppercase tracking-[0.08em] text-muted">
                      {formatFechaHora(evento.fecha)}
                    </p>
                  </div>
                  {evento.nota && (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{evento.nota}</p>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section className="border border-line bg-white">
            <div className="border-b border-line px-4 py-2.5">
              <p className="eyebrow">Avanzar estado</p>
            </div>
            <div className="p-4">
              <label htmlFor="nota-estado" className="field-label">
                Nota del movimiento (opcional)
              </label>
              <textarea
                id="nota-estado"
                value={nota}
                onChange={(event) => setNota(event.target.value)}
                rows={2}
                maxLength={300}
                className="field resize-none"
                placeholder="Pago confirmado, despachado en flete de las 4 p. m."
              />

              {error && (
                <div className="mt-3 flex items-start gap-2 border-l-2 border-red bg-red/[0.04] px-3 py-2">
                  <Icon name="alert" size={14} className="mt-0.5 shrink-0 text-red" />
                  <p className="text-[12px] leading-snug text-red">{error}</p>
                </div>
              )}

              {paquete.siguientesEstados && paquete.siguientesEstados.length > 0 ? (
                <div className="mt-4 flex flex-col gap-2">
                  {paquete.siguientesEstados.map((estado) => (
                    <button
                      key={estado}
                      type="button"
                      onClick={() => void cambiarEstado(estado)}
                      disabled={actualizando !== null}
                      className={cn(
                        'btn w-full disabled:opacity-60',
                        estado === 'CANCELADO' ? 'btn-outline text-red' : 'btn-primary',
                      )}
                    >
                      {actualizando === estado ? 'Actualizando…' : `Marcar como ${ETIQUETAS_ESTADO[estado]}`}
                      {actualizando !== estado && <Icon name="arrowRight" size={13} />}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-4 border border-line bg-paper px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                  Estado final. No hay más transiciones disponibles.
                </p>
              )}

              <p className="mt-3 font-mono text-[8px] uppercase leading-relaxed tracking-[0.08em] text-muted">
                Al cambiar el estado, el cliente recibe un aviso por WhatsApp desde el servidor.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
