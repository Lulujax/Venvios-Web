import { useCallback, useEffect, useState } from 'react';
import { whatsappLink } from '../../config/brand';
import { api } from '../../lib/api';
import { formatCOP, formatNumero } from '../../lib/format';
import type { Tarifa } from '../../types';
import { Icon } from '../ui/Icon';
import { Reveal } from '../Reveal';

export function RatesTable() {
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await api.get<{ tarifas: Tarifa[] }>('/tarifas');
      setTarifas(data.tarifas);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos cargar la tabla de tarifas.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <section id="tarifas" className="scroll-mt-24 border-b border-line bg-bone">
      <div className="shell py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
            <p className="eyebrow">§ 04 / Tarifa</p>
            <Reveal>
              <h2 className="display-lg mt-4 max-w-[13ch] text-balance">
                Una sola tarifa. Sin letra pequeña.
              </h2>
              <p className="mt-5 max-w-[42ch] text-sm leading-relaxed text-muted sm:text-base">
                El costo depende únicamente del peso cobrable de tu paquete. No hay tarifas por libra
                aérea, pie cúbico marítimo ni divisiones de servicio.
              </p>
              <div className="mt-7 border-l-2 border-gold pl-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink/60">
                  Peso cobrable = mayor entre peso real y volumétrico
                </p>
                <p className="mt-1.5 font-mono text-[10px] text-muted">
                  Largo × Ancho × Alto ÷ 5000
                </p>
              </div>
              <a
                href={whatsappLink('Hola, necesito una cotización para un paquete a Venezuela.')}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline mt-8"
              >
                <Icon name="whatsapp" size={14} />
                Consultar por WhatsApp
              </a>
            </Reveal>
          </div>

          <div className="lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/25 pb-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink">
                Costo de envío por paquete
              </p>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                COP · Colombia → Venezuela
              </p>
            </div>

            <div className="mt-1 grid grid-cols-12 gap-3 py-3 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
              <p className="col-span-6 sm:col-span-5">Tramo</p>
              <p className="col-span-3 sm:col-span-4">Peso cobrable</p>
              <p className="col-span-3 text-right">Costo</p>
            </div>

            <div className="border-t border-ink/15">
              {cargando &&
                Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 items-center gap-3 border-b border-ink/10 py-5"
                  >
                    <div className="col-span-6 h-3 bg-ink/[0.07] sm:col-span-5" />
                    <div className="col-span-3 h-3 bg-ink/[0.07] sm:col-span-4" />
                    <div className="col-span-3 ml-auto h-4 w-20 bg-ink/[0.07]" />
                  </div>
                ))}

              {!cargando && error && (
                <div className="flex flex-col gap-4 border-b border-ink/10 py-10">
                  <div className="flex items-start gap-3">
                    <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-red" />
                    <div>
                      <p className="text-sm font-medium text-ink">No pudimos cargar las tarifas.</p>
                      <p className="mt-1 max-w-[46ch] text-sm text-muted">{error}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void cargar()} className="btn btn-outline btn-sm">
                      <Icon name="refresh" size={13} />
                      Reintentar
                    </button>
                    <a
                      href={whatsappLink('Hola, necesito la tabla de tarifas vigente.')}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary btn-sm"
                    >
                      <Icon name="whatsapp" size={13} />
                      Pedir por WhatsApp
                    </a>
                  </div>
                </div>
              )}

              {!cargando && !error && tarifas.length === 0 && (
                <p className="border-b border-ink/10 py-10 text-sm text-muted">
                  La tabla de tarifas aún no está publicada. Consulta por WhatsApp.
                </p>
              )}

              {!cargando &&
                !error &&
                tarifas.map((tarifa, index) => {
                  const esUltimo = index === tarifas.length - 1;
                  const excedente = esUltimo && tarifa.precioKgExcedente;
                  return (
                    <div
                      key={tarifa.id}
                      className="grid grid-cols-12 items-baseline gap-3 border-b border-ink/10 py-5"
                    >
                      <div className="col-span-6 sm:col-span-5">
                        <p className="text-sm font-medium leading-snug text-ink">{tarifa.nombre}</p>
                        <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                          Por paquete
                        </p>
                      </div>
                      <p className="col-span-3 font-mono text-[11px] text-muted sm:col-span-4">
                        Hasta {formatNumero(tarifa.pesoHasta)} kg
                      </p>
                      <div className="col-span-3 text-right">
                        <p className="font-mono text-[15px] font-medium tabular text-ink sm:text-base">
                          {formatCOP(tarifa.precio)}
                        </p>
                        {excedente && (
                          <p className="mt-1 font-mono text-[9px] text-muted">
                            + {formatCOP(tarifa.precioKgExcedente ?? 0)} / kg extra
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <p className="max-w-[52ch] text-xs leading-relaxed text-muted">
                Precios en pesos colombianos por paquete. Sujetos a peso y volumen: se cobra el mayor
                entre el peso real y el volumétrico. La cotización final se confirma al recibir el
                paquete en Cúcuta.
              </p>
              <p className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45">
                Tabla única · 2026
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
