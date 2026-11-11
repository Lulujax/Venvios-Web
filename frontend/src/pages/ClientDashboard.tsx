import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { formatFecha, formatFechaHora } from '../lib/format';
import { whatsappLink } from '../config/brand';
import type { Notificacion, Paquete, Prealerta } from '../types';
import { BrandMark } from '../components/ui/BrandMark';
import { Icon } from '../components/ui/Icon';
import { PrealertaBadge } from '../components/ui/StatusBadge';
import { CasilleroCard } from '../components/Client/CasilleroCard';
import { PackageList } from '../components/Client/PackageList';
import { PrealertaForm } from '../components/Client/PrealertaForm';

function StatCell({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="px-4 py-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">{etiqueta}</p>
      <p className="mt-1 font-mono text-[26px] leading-none tracking-tight text-ink">
        {String(valor).padStart(2, '0')}
      </p>
    </div>
  );
}

export function ClientDashboard() {
  const { usuario, salir } = useAuth();
  const navigate = useNavigate();

  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [prealertas, setPrealertas] = useState<Prealerta[]>([]);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [paquetesData, prealertasData, notificacionesData] = await Promise.all([
        api.get<{ paquetes: Paquete[] }>('/paquetes'),
        api.get<{ prealertas: Prealerta[] }>('/prealertas'),
        api.get<{ notificaciones: Notificacion[] }>('/notificaciones'),
      ]);
      setPaquetes(paquetesData.paquetes);
      setPrealertas(prealertasData.prealertas);
      setNotificaciones(notificacionesData.notificaciones);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos cargar tu panel.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cerrarSesion = async () => {
    await salir();
    navigate('/');
  };

  const activos = paquetes.filter(
    (paquete) => paquete.estado !== 'ENTREGADO' && paquete.estado !== 'CANCELADO',
  ).length;
  const pendientes = prealertas.filter((prealerta) => prealerta.estado === 'PENDIENTE').length;
  const entregados = paquetes.filter((paquete) => paquete.estado === 'ENTREGADO').length;

  const fechaHoy = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Bogota',
  }).format(new Date());

  const primerNombre = usuario?.nombre.split(' ')[0] ?? '';

  return (
    <div className="min-h-[100dvh] bg-paper">
      <header className="sticky top-0 z-30 border-b border-line bg-paper">
        <div className="shell flex h-16 items-center justify-between gap-4">
          <Link to="/" aria-label="Venvios Express, inicio">
            <BrandMark />
          </Link>
          <div className="flex items-center gap-3 sm:gap-5">
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.18em] text-muted md:block">
              Panel cliente
            </span>
            <span className="hidden max-w-[180px] truncate text-xs text-ink/70 sm:block">
              {usuario?.nombre}
            </span>
            <button
              type="button"
              onClick={() => void cerrarSesion()}
              className="btn btn-outline btn-sm"
            >
              <Icon name="logout" size={13} />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="shell py-8 lg:py-12">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <aside className="space-y-6 lg:col-span-4">
            <CasilleroCard casillero={usuario?.casillero ?? null} />

            <div className="border border-line bg-white p-4">
              <p className="meta">Atención de la sede</p>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">
                Días de recepción, pagos y novedades de la ruta. Respuesta directa de operaciones.
              </p>
              <a
                href={whatsappLink('Hola, soy cliente de Venvios Express y necesito ayuda.')}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm mt-4 w-full"
              >
                <Icon name="whatsapp" size={13} />
                Escribir por WhatsApp
              </a>
              <Link
                to="/rastreo"
                className="footer-link mt-3 inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted"
              >
                Consultar guía pública
                <Icon name="arrowUpRight" size={11} />
              </Link>
            </div>

            <section className="border border-line bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                <p className="eyebrow">Notificaciones</p>
                <span className="font-mono text-[9px] text-muted">
                  {String(notificaciones.length).padStart(2, '0')}
                </span>
              </div>

              {cargando ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="space-y-2">
                      <div className="h-2.5 w-full bg-ink/[0.06]" />
                      <div className="h-2 w-2/3 bg-ink/[0.05]" />
                    </div>
                  ))}
                </div>
              ) : notificaciones.length === 0 ? (
                <p className="p-4 text-[12px] leading-relaxed text-muted">
                  Sin notificaciones todavía. Aquí verás los avisos enviados a tu WhatsApp.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {notificaciones.slice(0, 6).map((notificacion) => (
                    <li key={notificacion.id} className="flex gap-3 px-4 py-3">
                      <Icon name="whatsapp" size={14} className="mt-0.5 shrink-0 text-gold" />
                      <div>
                        <p className="text-[12px] leading-relaxed text-ink">{notificacion.mensaje}</p>
                        <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.08em] text-muted">
                          {notificacion.destino} · {formatFechaHora(notificacion.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="border-t border-line px-4 py-2.5 font-mono text-[8px] uppercase leading-relaxed tracking-[0.08em] text-muted">
                Destino enmascarado por seguridad
              </p>
            </section>
          </aside>

          <div className="space-y-10 lg:col-span-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Manifiesto personal</p>
                <h1 className="display-md mt-2">Hola, {primerNombre}.</h1>
                <p className="mt-2 text-sm text-muted">
                  {fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1)} · Cúcuta, Colombia
                </p>
              </div>
              <Link to="/" className="btn btn-ghost btn-sm">
                <Icon name="chevronLeft" size={13} />
                Ir al inicio
              </Link>
            </div>

            {error && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-red bg-red/[0.04] px-4 py-3">
                <div className="flex items-start gap-3">
                  <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-red" />
                  <p className="text-sm leading-snug text-red">{error}</p>
                </div>
                <button type="button" onClick={() => void cargar()} className="btn btn-outline btn-sm">
                  <Icon name="refresh" size={12} />
                  Reintentar
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 divide-x divide-line border border-line bg-white">
              <StatCell etiqueta="En curso" valor={activos} />
              <StatCell etiqueta="Prealertas" valor={pendientes} />
              <StatCell etiqueta="Entregados" valor={entregados} />
            </div>

            <PrealertaForm onCreada={() => void cargar()} />

            <section aria-labelledby="titulo-paquetes">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink/20 pb-3">
                <div>
                  <p className="eyebrow">§ 02 / Paquetes</p>
                  <h2 id="titulo-paquetes" className="display-md mt-2">
                    Tu manifiesto
                  </h2>
                </div>
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                  {String(paquetes.length).padStart(2, '0')} registros
                </p>
              </div>
              <PackageList paquetes={paquetes} cargando={cargando} />
            </section>

            <section aria-labelledby="titulo-prealertas">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink/20 pb-3">
                <div>
                  <p className="eyebrow">§ 03 / Prealertas</p>
                  <h2 id="titulo-prealertas" className="display-md mt-2">
                    Avisos en camino
                  </h2>
                </div>
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                  {String(prealertas.length).padStart(2, '0')} avisos
                </p>
              </div>

              {cargando ? (
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div key={index} className="border border-line bg-white p-4">
                      <div className="h-3 w-36 bg-ink/[0.06]" />
                      <div className="mt-2 h-2.5 w-2/3 bg-ink/[0.05]" />
                    </div>
                  ))}
                </div>
              ) : prealertas.length === 0 ? (
                <div className="mt-4 border border-dashed border-ink/20 bg-white/60 p-6">
                  <p className="text-sm font-medium">No tienes prealertas registradas.</p>
                  <p className="mt-1 max-w-[46ch] text-sm leading-relaxed text-muted">
                    Usa el formulario de arriba para avisar qué compra viene en camino a Cúcuta.
                  </p>
                </div>
              ) : (
                <div className="mt-4 border border-line bg-white">
                  {prealertas.map((prealerta) => (
                    <div
                      key={prealerta.id}
                      className="grid gap-2 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-12 sm:items-center sm:gap-4"
                    >
                      <div className="sm:col-span-5">
                        <p className="text-sm font-medium text-ink">{prealerta.tienda}</p>
                        <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-muted">
                          {prealerta.descripcion}
                        </p>
                      </div>
                      <div className="sm:col-span-3">
                        <PrealertaBadge estado={prealerta.estado} />
                      </div>
                      <div className="sm:col-span-4 sm:text-right">
                        <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
                          {prealerta.trackingTienda ?? 'Sin guía de tienda'}
                        </p>
                        <p className="mt-0.5 font-mono text-[9px] text-muted">
                          {formatFecha(prealerta.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      <footer className="mt-10 border-t border-line">
        <div className="shell flex flex-wrap items-center justify-between gap-3 py-6 font-mono text-[8px] uppercase tracking-[0.12em] text-muted">
          <span>© 2026 Venvios Express · Barrio Latino, Cúcuta</span>
          <span>Ruta Colombia → Venezuela · Puerta a puerta</span>
          <span>Tu mejor opción</span>
        </div>
      </footer>
    </div>
  );
}
