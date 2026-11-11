import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Landing/Navbar';
import { Footer } from '../components/Landing/Footer';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Icon } from '../components/ui/Icon';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { ETIQUETAS_ESTADO } from '../lib/estados';
import { formatFechaHora, formatPeso } from '../lib/format';
import { whatsappLink } from '../config/brand';
import type { PaquetePublico } from '../types';

function BotonBuscar({ cargando }: { cargando: boolean }) {
  return (
    <button type="submit" disabled={cargando} className="btn btn-primary shrink-0 disabled:opacity-60">
      {cargando ? 'Buscando…' : 'Buscar guía'}
      {!cargando && <Icon name="search" size={14} />}
    </button>
  );
}

export function TrackPage() {
  const [guia, setGuia] = useState('');
  const [consultada, setConsultada] = useState<string | null>(null);
  const [paquete, setPaquete] = useState<PaquetePublico | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const buscar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizada = guia.trim().toUpperCase();
    if (!normalizada) {
      setError('Escribe el número de guía que aparece en tu comprobante.');
      return;
    }

    setCargando(true);
    setError(null);
    setPaquete(null);
    setConsultada(normalizada);

    try {
      const data = await api.get<{ paquete: PaquetePublico }>(
        `/rastreo/${encodeURIComponent(normalizada)}`,
      );
      setPaquete(data.paquete);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No pudimos consultar la guía. Intenta de nuevo en un momento.',
      );
    } finally {
      setCargando(false);
    }
  };

  const ultimoEvento = paquete?.eventos[paquete.eventos.length - 1];

  return (
    <div className="min-h-[100dvh] bg-paper">
      <Navbar />

      <main>
        <section className="border-b border-line">
          <div className="shell py-14 lg:py-20">
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
              <div className="lg:col-span-5">
                <p className="eyebrow">§ Rastreo / Manifiesto público</p>
                <h1 className="display-lg mt-4 max-w-[13ch] text-balance">
                  Sigue tu paquete, paso por paso.
                </h1>
                <p className="mt-5 max-w-[46ch] text-sm leading-relaxed text-muted sm:text-base">
                  Consulta el estado de tu envío con el número de guía. Solo mostramos la trazabilidad
                  del paquete: ningún dato personal del destinatario.
                </p>

                <form onSubmit={buscar} className="mt-8" noValidate>
                  <label htmlFor="guia" className="field-label">
                    Número de guía
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      id="guia"
                      name="guia"
                      type="text"
                      value={guia}
                      onChange={(event) => setGuia(event.target.value)}
                      placeholder="VEX-2026-04217"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      className="field font-mono uppercase tracking-[0.08em]"
                    />
                    <BotonBuscar cargando={cargando} />
                  </div>
                  <p className="mt-2 font-mono text-[9px] uppercase leading-relaxed tracking-[0.1em] text-muted">
                    Formato VEX-2026-00001 · Lo encuentras en tu panel y en el WhatsApp de recepción.
                  </p>
                </form>

                <div className="mt-8 border-t border-ink/15 pt-5">
                  <Link
                    to="/login"
                    className="link-underline inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-navy"
                  >
                    Entrar a mi cuenta
                    <Icon name="arrowRight" size={13} />
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-6 lg:col-start-7">
                {!consultada && !cargando && (
                  <div className="border border-dashed border-ink/25 bg-white/60 p-6 sm:p-8">
                    <div className="flex items-start justify-between gap-4 border-b border-ink/10 pb-4">
                      <div>
                        <p className="meta">Consulta de guía</p>
                        <p className="mt-1 font-display text-xl font-bold text-ink/40">
                          VEX-2026-•••••
                        </p>
                      </div>
                      <Icon name="barcode" size={28} className="text-line" />
                    </div>
                    <div className="barcode mt-6 text-line" aria-hidden="true" />
                    <p className="mt-6 max-w-[36ch] text-sm leading-relaxed text-muted">
                      Ingresa tu guía para ver el manifiesto: fecha de recepción, peso cobrable y cada
                      movimiento registrado en Cúcuta y en la ruta a Venezuela.
                    </p>
                    <div className="mt-6 grid grid-cols-3 gap-3 border-t border-ink/10 pt-4">
                      {['Recibido', 'En ruta', 'Entregado'].map((estado) => (
                        <p
                          key={estado}
                          className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted"
                        >
                          {estado}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {cargando && (
                  <div className="border border-line bg-white p-6 sm:p-8">
                    <div className="h-3 w-32 bg-ink/[0.07]" />
                    <div className="mt-4 h-7 w-52 bg-ink/[0.07]" />
                    <div className="mt-8 space-y-4">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="space-y-2 border-b border-line pb-4">
                          <div className="h-2.5 w-24 bg-ink/[0.06]" />
                          <div className="h-3 w-40 bg-ink/[0.06]" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {error && !cargando && (
                  <div className="border border-line bg-white p-6 sm:p-8">
                    <div className="flex items-start gap-3 border-l-2 border-red bg-red/[0.04] px-4 py-3">
                      <Icon name="alert" size={17} className="mt-0.5 shrink-0 text-red" />
                      <div>
                        <p className="text-sm font-medium text-red">No encontramos esa guía.</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted">{error}</p>
                      </div>
                    </div>
                    <p className="mt-5 text-sm leading-relaxed text-muted">
                      Verifica que el código esté completo. Si el paquete acaba de llegar a Cúcuta,
                      espera unos minutos y vuelve a intentar.
                    </p>
                    <a
                      href={whatsappLink(
                        `Hola, necesito ayuda para rastrear la guía ${consultada ?? ''}.`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline mt-6"
                    >
                      <Icon name="whatsapp" size={14} />
                      Escribir a la sede
                    </a>
                  </div>
                )}

                {paquete && !cargando && (
                  <article className="border border-ink/20 bg-white">
                    <header className="flex items-start justify-between gap-4 border-b border-ink/15 bg-navy px-5 py-4 text-paper">
                      <div>
                        <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-paper/50">
                          Guía consultada
                        </p>
                        <p className="mt-1 font-mono text-[17px] tracking-tight">{paquete.guia}</p>
                      </div>
                      <Icon name="package" size={26} className="text-gold" />
                    </header>

                    <div className="p-5 sm:p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <StatusBadge estado={paquete.estado} />
                        <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                          Actualizado {formatFechaHora(paquete.actualizadoEn)}
                        </p>
                      </div>

                      <div className="mt-5 grid grid-cols-2 border-y border-ink/15 py-4 sm:grid-cols-3">
                        <div className="pr-3">
                          <p className="meta">Recibido</p>
                          <p className="mt-1 font-mono text-[11px]">{formatFechaHora(paquete.createdAt)}</p>
                        </div>
                        <div className="border-l border-ink/15 px-3">
                          <p className="meta">Peso cobrable</p>
                          <p className="mt-1 font-mono text-[11px]">{formatPeso(paquete.pesoCobrable)}</p>
                        </div>
                        <div className="col-span-2 mt-4 border-t border-ink/10 pt-4 sm:col-span-1 sm:mt-0 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
                          <p className="meta">Estado actual</p>
                          <p className="mt-1 text-[12px] font-medium">
                            {ETIQUETAS_ESTADO[paquete.estado]}
                          </p>
                        </div>
                      </div>

                      <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                        Trazabilidad · {paquete.eventos.length} evento
                        {paquete.eventos.length === 1 ? '' : 's'}
                      </p>

                      <ol className="mt-3">
                        {paquete.eventos.map((evento, index) => {
                          const esUltimo = index === paquete.eventos.length - 1;
                          return (
                            <li key={`${evento.estado}-${evento.fecha}`} className="relative pb-5 pl-7 last:pb-0">
                              {!esUltimo && (
                                <span
                                  className="absolute left-[5px] top-3 h-full w-px bg-line"
                                  aria-hidden="true"
                                />
                              )}
                              <span
                                className={cn(
                                  'absolute left-0 top-1.5 h-[11px] w-[11px] border',
                                  esUltimo ? 'border-gold bg-gold' : 'border-ink/30 bg-paper',
                                )}
                                aria-hidden="true"
                              />
                              <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                                {formatFechaHora(evento.fecha)}
                              </p>
                              <p className="mt-0.5 text-sm font-medium text-ink">
                                {ETIQUETAS_ESTADO[evento.estado]}
                              </p>
                              {evento.nota && (
                                <p className="mt-1 text-[13px] leading-relaxed text-muted">
                                  {evento.nota}
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ol>

                      {ultimoEvento && (
                        <p className="mt-5 border-t border-dashed border-ink/20 pt-3 font-mono text-[9px] uppercase leading-relaxed tracking-[0.1em] text-muted">
                          Último movimiento: {ETIQUETAS_ESTADO[ultimoEvento.estado]} ·{' '}
                          {formatFechaHora(ultimoEvento.fecha)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper px-5 py-3">
                      <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-muted">
                        Venvios Express · Barrio Latino, Cúcuta
                      </p>
                      <a
                        href={whatsappLink(`Hola, tengo una pregunta sobre la guía ${paquete.guia}.`)}
                        target="_blank"
                        rel="noreferrer"
                        className="footer-link inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-navy"
                      >
                        <Icon name="whatsapp" size={13} />
                        Consultar
                      </a>
                    </div>
                  </article>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
