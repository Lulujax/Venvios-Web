import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { ESTADOS_PAQUETE } from '../lib/estados';
import { formatCOP, formatFecha, formatFechaHora, formatPeso } from '../lib/format';
import type {
  EstadoPaquete,
  EstadoPrealerta,
  Paginado,
  Paquete,
  Prealerta,
  ResumenAdmin,
} from '../types';
import { BrandMark } from '../components/ui/BrandMark';
import { Icon, type IconName } from '../components/ui/Icon';
import { PrealertaBadge, StatusBadge } from '../components/ui/StatusBadge';
import { PackageDrawer } from '../components/Admin/PackageDrawer';
import { ReceptionModal } from '../components/Admin/ReceptionModal';
import { Scanner } from '../components/Admin/Scanner';

type Vista = 'PAQUETES' | 'PREALERTAS' | 'ESCANNER';

const POR_PAGINA = 25;

const VISTAS: Array<{ id: Vista; etiqueta: string; icono: IconName }> = [
  { id: 'PAQUETES', etiqueta: 'Paquetes', icono: 'package' },
  { id: 'PREALERTAS', etiqueta: 'Prealertas', icono: 'file' },
  { id: 'ESCANNER', etiqueta: 'Escáner', icono: 'scan' },
];

const FILTROS_PREALERTA: Array<EstadoPrealerta | 'TODAS'> = ['TODAS', 'PENDIENTE', 'RECIBIDA', 'CANCELADA'];

function StatCell({
  etiqueta,
  valor,
  acento = false,
  className,
}: {
  etiqueta: string;
  valor: string;
  acento?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('border-t border-line px-4 py-4', className)}>
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">{etiqueta}</p>
      <p
        className={cn(
          'mt-1 font-mono leading-none tracking-tight',
          acento ? 'text-[18px] text-navy' : 'text-[24px] text-ink',
        )}
      >
        {valor}
      </p>
    </div>
  );
}

export function AdminDashboard() {
  const { usuario, salir } = useAuth();
  const navigate = useNavigate();

  const [vista, setVista] = useState<Vista>('PAQUETES');

  const [resumen, setResumen] = useState<ResumenAdmin | null>(null);
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [totalPaquetes, setTotalPaquetes] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [prealertas, setPrealertas] = useState<Prealerta[]>([]);
  const [filtroPrealerta, setFiltroPrealerta] = useState<EstadoPrealerta | 'TODAS'>('TODAS');

  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoPaquete | 'TODOS'>('TODOS');

  const [cargandoPaquetes, setCargandoPaquetes] = useState(true);
  const [cargandoPrealertas, setCargandoPrealertas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paqueteActivo, setPaqueteActivo] = useState<Paquete | null>(null);
  const [recepcionAbierta, setRecepcionAbierta] = useState(false);
  const [prealertaRecepcion, setPrealertaRecepcion] = useState<Prealerta | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const mostrarToast = useCallback((mensaje: string) => {
    setToast(mensaje);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  // ---------- Carga de datos ----------

  const cargarResumen = useCallback(async () => {
    try {
      const data = await api.get<{ resumen: ResumenAdmin }>('/admin/resumen');
      setResumen(data.resumen);
    } catch {
      // El resumen es informativo; el error principal lo marcan las tablas.
    }
  }, []);

  const cargarPaquetes = useCallback(async () => {
    setCargandoPaquetes(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        pagina: String(pagina),
        porPagina: String(POR_PAGINA),
      });
      if (filtroEstado !== 'TODOS') params.set('estado', filtroEstado);
      if (busquedaAplicada) params.set('q', busquedaAplicada);

      const data = await api.get<Paginado<Paquete>>(`/admin/paquetes?${params.toString()}`);
      setPaquetes(data.items);
      setTotalPaquetes(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos cargar el manifiesto.');
    } finally {
      setCargandoPaquetes(false);
    }
  }, [pagina, filtroEstado, busquedaAplicada]);

  const cargarPrealertas = useCallback(async () => {
    setCargandoPrealertas(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filtroPrealerta !== 'TODAS') params.set('estado', filtroPrealerta);
      const data = await api.get<{ prealertas: Prealerta[] }>(
        `/admin/prealertas?${params.toString()}`,
      );
      setPrealertas(data.prealertas);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos cargar las prealertas.');
    } finally {
      setCargandoPrealertas(false);
    }
  }, [filtroPrealerta]);

  useEffect(() => {
    void cargarResumen();
  }, [cargarResumen]);

  useEffect(() => {
    if (vista === 'PAQUETES') void cargarPaquetes();
  }, [vista, cargarPaquetes]);

  useEffect(() => {
    if (vista === 'PREALERTAS') void cargarPrealertas();
  }, [vista, cargarPrealertas]);

  const refrescarTodo = useCallback(() => {
    void cargarResumen();
    void cargarPaquetes();
    void cargarPrealertas();
  }, [cargarResumen, cargarPaquetes, cargarPrealertas]);

  // ---------- Acciones ----------

  const cambiarFiltroEstado = (estado: EstadoPaquete | 'TODOS') => {
    setFiltroEstado(estado);
    setPagina(1);
  };

  const buscar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPagina(1);
    setBusquedaAplicada(busqueda.trim());
  };

  const limpiarBusqueda = () => {
    setBusqueda('');
    setPagina(1);
    setBusquedaAplicada('');
  };

  const abrirRecepcion = (prealerta: Prealerta | null) => {
    setPrealertaRecepcion(prealerta);
    setRecepcionAbierta(true);
  };

  const cerrarSesion = async () => {
    await salir();
    navigate('/');
  };

  const totalPaginas = Math.max(1, Math.ceil(totalPaquetes / POR_PAGINA));
  const enRuta = (resumen?.porEstado.EN_TRANSITO ?? 0) + (resumen?.porEstado.EN_ADUANA ?? 0);

  // ---------- Render ----------

  const nav = (
    <nav aria-label="Secciones de operación" className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5 lg:overflow-visible">
      {VISTAS.map((item) => {
        const activo = vista === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setVista(item.id)}
            aria-current={activo ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2.5 border px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] transition-colors',
              'lg:border-x-0 lg:px-4 lg:py-2.5',
              activo
                ? 'border-gold/60 bg-gold/[0.12] text-gold lg:border-l-2 lg:border-gold lg:bg-white/[0.06] lg:text-paper'
                : 'border-transparent text-paper/55 hover:text-paper lg:hover:bg-white/[0.04]',
            )}
          >
            <Icon name={item.icono} size={15} />
            {item.etiqueta}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-[100dvh] bg-paper lg:pl-60">
      {/* Barra lateral (escritorio) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-navy-800 bg-navy lg:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <Link to="/" aria-label="Venvios Express, inicio">
            <BrandMark light />
          </Link>
          <p className="mt-4 font-mono text-[8px] uppercase tracking-[0.18em] text-paper/40">
            Consola de operación · Cúcuta
          </p>
        </div>

        <div className="flex-1 overflow-y-auto py-4">{nav}</div>

        <div className="border-t border-white/10 px-5 py-4">
          <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-paper/40">Operador</p>
          <p className="mt-1 truncate text-[13px] font-medium text-paper">{usuario?.nombre}</p>
          <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-paper/45">
            Acceso administrador
          </p>
          <button
            type="button"
            onClick={() => void cerrarSesion()}
            className="mt-4 flex w-full items-center justify-center gap-2 border border-paper/25 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-paper/75 transition-colors hover:border-paper hover:text-paper"
          >
            <Icon name="logout" size={13} />
            Cerrar sesión
          </button>
          <p className="mt-4 flex items-start gap-1.5 font-mono text-[7px] uppercase leading-relaxed tracking-[0.1em] text-paper/35">
            <Icon name="lock" size={11} className="mt-px shrink-0" />
            Los teléfonos de clientes nunca se muestran en esta consola.
          </p>
        </div>
      </aside>

      {/* Cabecera (móvil) */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-navy lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" aria-label="Venvios Express, inicio">
            <BrandMark light />
          </Link>
          <button
            type="button"
            onClick={() => void cerrarSesion()}
            className="grid h-9 w-9 place-items-center border border-paper/25 text-paper/75"
            aria-label="Cerrar sesión"
          >
            <Icon name="logout" size={15} />
          </button>
        </div>
        <div className="border-t border-white/10 px-2 py-2">{nav}</div>
      </header>

      <main className="min-w-0">
        {/* Encabezado de la consola */}
        <div className="border-b border-line bg-white">
          <div className="flex flex-wrap items-end justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
            <div>
              <p className="eyebrow">Centro de control · Sede Barrio Latino</p>
              <h1 className="display-md mt-2">Operación Cúcuta</h1>
              <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                {formatFechaHora(new Date().toISOString())} · Ruta Colombia → Venezuela
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void cargarPaquetes()}
                className="btn btn-outline btn-sm"
                aria-label="Actualizar manifiesto"
              >
                <Icon name="refresh" size={13} />
                <span className="hidden sm:inline">Actualizar</span>
              </button>
              <button type="button" onClick={() => abrirRecepcion(null)} className="btn btn-primary btn-sm">
                <Icon name="plus" size={13} />
                Nueva recepción
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x lg:divide-line">
            <StatCell etiqueta="Total paquetes" valor={String(resumen?.totalPaquetes ?? '—')} />
            <StatCell etiqueta="En ruta / aduana" valor={resumen ? String(enRuta) : '—'} />
            <StatCell etiqueta="Prealertas" valor={resumen ? String(resumen.prealertasPendientes) : '—'} />
            <StatCell etiqueta="Clientes" valor={resumen ? String(resumen.clientes) : '—'} />
            <StatCell
              etiqueta="Ingresos entregados"
              valor={resumen ? formatCOP(resumen.ingresosEntregados) : '—'}
              acento
              className="col-span-2 sm:col-span-1"
            />
          </div>
        </div>

        {/* Contenido por vista */}
        <div className="px-4 py-6 sm:px-6 lg:px-8">
          {error && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-l-2 border-red bg-red/[0.04] px-4 py-3">
              <div className="flex items-start gap-3">
                <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-red" />
                <p className="text-sm leading-snug text-red">{error}</p>
              </div>
              <button type="button" onClick={refrescarTodo} className="btn btn-outline btn-sm">
                <Icon name="refresh" size={12} />
                Reintentar
              </button>
            </div>
          )}

          {vista === 'PAQUETES' && (
            <section aria-labelledby="titulo-paquetes">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">§ 01 / Manifiesto</p>
                  <h2 id="titulo-paquetes" className="display-md mt-2">
                    Paquetes registrados
                  </h2>
                </div>
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                  {String(totalPaquetes).padStart(2, '0')} registros · página {pagina}/{totalPaginas}
                </p>
              </div>

              <form onSubmit={buscar} className="mb-4 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Icon
                    name="search"
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(event) => setBusqueda(event.target.value)}
                    className="field pl-9 font-mono uppercase"
                    placeholder="Guía, cliente o casillero…"
                    aria-label="Buscar por guía, cliente o casillero"
                  />
                </div>
                <select
                  value={filtroEstado}
                  onChange={(event) => cambiarFiltroEstado(event.target.value as EstadoPaquete | 'TODOS')}
                  className="field shrink-0 font-mono text-[11px] uppercase"
                  aria-label="Filtrar por estado"
                >
                  <option value="TODOS">Todos los estados</option>
                  {ESTADOS_PAQUETE.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado.replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn btn-outline shrink-0">
                  Buscar
                </button>
                {(busquedaAplicada || filtroEstado !== 'TODOS') && (
                  <button
                    type="button"
                    onClick={() => {
                      setBusqueda('');
                      cambiarFiltroEstado('TODOS');
                    }}
                    className="btn btn-ghost shrink-0"
                  >
                    <Icon name="close" size={12} />
                    Limpiar
                  </button>
                )}
              </form>

              {/* Móvil: tarjetas apiladas */}
              <div className="space-y-3 sm:hidden">
                {cargandoPaquetes &&
                  Array.from({ length: 5 }).map((_, index) => (
                    <div key={`skeleton-movil-${index}`} className="border border-line bg-white p-4">
                      <div className="h-3 w-32 bg-ink/[0.06]" />
                      <div className="mt-2.5 h-3 w-40 bg-ink/[0.05]" />
                      <div className="mt-4 h-2.5 w-full bg-ink/[0.04]" />
                    </div>
                  ))}

                {!cargandoPaquetes && paquetes.length === 0 && (
                  <div className="border border-dashed border-ink/20 bg-white/60 p-6 text-center">
                    <p className="text-sm font-medium text-ink">Sin resultados en el manifiesto.</p>
                    <p className="mt-1 text-[12px] text-muted">
                      Ajusta la búsqueda o registra una nueva recepción.
                    </p>
                  </div>
                )}

                {!cargandoPaquetes &&
                  paquetes.map((paquete) => (
                    <button
                      key={`movil-${paquete.id}`}
                      type="button"
                      onClick={() => setPaqueteActivo(paquete)}
                      className="w-full border border-line bg-white p-4 text-left transition-colors active:bg-paper/70"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-mono text-[12px] tracking-tight text-ink">{paquete.guia}</p>
                        <StatusBadge estado={paquete.estado} />
                      </div>
                      <p className="mt-2.5 text-[13px] font-medium text-ink">
                        {paquete.cliente?.nombre ?? 'Sin cliente'}
                      </p>
                      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                        {paquete.cliente?.casillero ?? 'Sin casillero'}
                      </p>
                      <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-muted">
                        {paquete.descripcion}
                      </p>
                      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 font-mono text-[10px] text-ink">
                        <span>{formatPeso(paquete.pesoCobrable)}</span>
                        <span>{formatCOP(paquete.precio)}</span>
                      </div>
                    </button>
                  ))}
              </div>

              {/* Escritorio: tabla */}
              <div className="hidden overflow-x-auto border border-line bg-white sm:block">
                <table className="w-full min-w-[880px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line bg-paper">
                      {['Guía', 'Cliente', 'Descripción', 'Peso cobrable', 'Costo', 'Estado', 'Registrado', ''].map(
                        (encabezado, index) => (
                          <th
                            key={`${encabezado}-${index}`}
                            scope="col"
                            className="px-4 py-2.5 font-mono text-[8px] uppercase tracking-[0.14em] text-muted"
                          >
                            {encabezado}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {cargandoPaquetes &&
                      Array.from({ length: 6 }).map((_, index) => (
                        <tr key={`skeleton-${index}`} className="border-b border-line last:border-b-0">
                          <td className="px-4 py-3" colSpan={8}>
                            <div className="flex gap-4">
                              <div className="h-3 w-28 bg-ink/[0.06]" />
                              <div className="h-3 w-40 bg-ink/[0.05]" />
                              <div className="h-3 w-24 bg-ink/[0.04]" />
                            </div>
                          </td>
                        </tr>
                      ))}

                    {!cargandoPaquetes && paquetes.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-10 text-center">
                          <p className="text-sm font-medium text-ink">Sin resultados en el manifiesto.</p>
                          <p className="mt-1 text-[12px] text-muted">
                            Ajusta la búsqueda o registra una nueva recepción.
                          </p>
                        </td>
                      </tr>
                    )}

                    {!cargandoPaquetes &&
                      paquetes.map((paquete) => (
                        <tr
                          key={paquete.id}
                          tabIndex={0}
                          onClick={() => setPaqueteActivo(paquete)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') setPaqueteActivo(paquete);
                          }}
                          className="cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-paper/70 focus:bg-paper/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-navy/40"
                        >
                          <td className="px-4 py-3 font-mono text-[11px] tracking-tight text-ink">
                            {paquete.guia}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[13px] font-medium text-ink">
                              {paquete.cliente?.nombre ?? 'Sin cliente'}
                            </p>
                            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                              {paquete.cliente?.casillero ?? 'Sin casillero'}
                            </p>
                          </td>
                          <td className="max-w-[220px] px-4 py-3">
                            <p className="truncate text-[12px] text-muted">{paquete.descripcion}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px]">
                            {formatPeso(paquete.pesoCobrable)}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px]">{formatCOP(paquete.precio)}</td>
                          <td className="px-4 py-3">
                            <StatusBadge estado={paquete.estado} />
                          </td>
                          <td className="px-4 py-3 font-mono text-[10px] text-muted">
                            {formatFecha(paquete.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Icon name="chevronRight" size={14} className="text-muted" />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                  Mostrando {paquetes.length} de {totalPaquetes} paquetes
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPagina((previa) => Math.max(1, previa - 1))}
                    disabled={pagina <= 1 || cargandoPaquetes}
                    className="btn btn-outline btn-sm disabled:opacity-50"
                  >
                    <Icon name="chevronLeft" size={12} />
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setPagina((previa) => Math.min(totalPaginas, previa + 1))}
                    disabled={pagina >= totalPaginas || cargandoPaquetes}
                    className="btn btn-outline btn-sm disabled:opacity-50"
                  >
                    Siguiente
                    <Icon name="chevronRight" size={12} />
                  </button>
                </div>
              </div>
            </section>
          )}

          {vista === 'PREALERTAS' && (
            <section aria-labelledby="titulo-prealertas">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">§ 02 / Avisos</p>
                  <h2 id="titulo-prealertas" className="display-md mt-2">
                    Prealertas de clientes
                  </h2>
                </div>
                <div className="flex flex-wrap gap-1 border border-line bg-white p-1">
                  {FILTROS_PREALERTA.map((filtro) => (
                    <button
                      key={filtro}
                      type="button"
                      onClick={() => setFiltroPrealerta(filtro)}
                      aria-pressed={filtroPrealerta === filtro}
                      className={cn(
                        'px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors',
                        filtroPrealerta === filtro
                          ? 'bg-navy text-paper'
                          : 'text-muted hover:text-ink',
                      )}
                    >
                      {filtro === 'TODAS' ? 'Todas' : filtro}
                    </button>
                  ))}
                </div>
              </div>

              {/* Móvil: tarjetas apiladas con acción directa */}
              <div className="space-y-3 sm:hidden">
                {cargandoPrealertas &&
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={`skeleton-pre-movil-${index}`} className="border border-line bg-white p-4">
                      <div className="h-3 w-32 bg-ink/[0.06]" />
                      <div className="mt-2.5 h-3 w-40 bg-ink/[0.05]" />
                      <div className="mt-4 h-2.5 w-full bg-ink/[0.04]" />
                    </div>
                  ))}

                {!cargandoPrealertas && prealertas.length === 0 && (
                  <div className="border border-dashed border-ink/20 bg-white/60 p-6 text-center">
                    <p className="text-sm font-medium text-ink">Sin prealertas en este filtro.</p>
                    <p className="mt-1 text-[12px] text-muted">
                      Los avisos de compra aparecen aquí apenas el cliente los envía.
                    </p>
                  </div>
                )}

                {!cargandoPrealertas &&
                  prealertas.map((prealerta) => (
                    <div key={`movil-${prealerta.id}`} className="border border-line bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink">
                            {prealerta.cliente?.nombre ?? 'Sin cliente'}
                          </p>
                          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                            {prealerta.cliente?.casillero ?? 'Sin casillero'}
                          </p>
                        </div>
                        <PrealertaBadge estado={prealerta.estado} />
                      </div>
                      <p className="mt-2.5 text-[13px] font-medium text-ink">{prealerta.tienda}</p>
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-muted">
                        {prealerta.descripcion}
                      </p>
                      <div className="mt-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
                        <span>{prealerta.trackingTienda ?? 'Sin guía de tienda'}</span>
                        <span>{formatFecha(prealerta.createdAt)}</span>
                      </div>
                      {prealerta.estado === 'PENDIENTE' && (
                        <button
                          type="button"
                          onClick={() => abrirRecepcion(prealerta)}
                          className="btn btn-primary btn-sm mt-3.5 w-full"
                        >
                          <Icon name="package" size={12} />
                          Recibir en sede
                        </button>
                      )}
                    </div>
                  ))}
              </div>

              {/* Escritorio: tabla */}
              <div className="hidden overflow-x-auto border border-line bg-white sm:block">
                <table className="w-full min-w-[820px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line bg-paper">
                      {['Cliente', 'Tienda', 'Descripción', 'Tracking', 'Estado', 'Registrada', ''].map(
                        (encabezado, index) => (
                          <th
                            key={`${encabezado}-${index}`}
                            scope="col"
                            className="px-4 py-2.5 font-mono text-[8px] uppercase tracking-[0.14em] text-muted"
                          >
                            {encabezado}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {cargandoPrealertas &&
                      Array.from({ length: 4 }).map((_, index) => (
                        <tr key={`skeleton-pre-${index}`} className="border-b border-line last:border-b-0">
                          <td className="px-4 py-3" colSpan={7}>
                            <div className="flex gap-4">
                              <div className="h-3 w-32 bg-ink/[0.06]" />
                              <div className="h-3 w-40 bg-ink/[0.05]" />
                              <div className="h-3 w-20 bg-ink/[0.04]" />
                            </div>
                          </td>
                        </tr>
                      ))}

                    {!cargandoPrealertas && prealertas.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center">
                          <p className="text-sm font-medium text-ink">Sin prealertas en este filtro.</p>
                          <p className="mt-1 text-[12px] text-muted">
                            Los avisos de compra aparecen aquí apenas el cliente los envía.
                          </p>
                        </td>
                      </tr>
                    )}

                    {!cargandoPrealertas &&
                      prealertas.map((prealerta) => (
                        <tr key={prealerta.id} className="border-b border-line last:border-b-0">
                          <td className="px-4 py-3">
                            <p className="text-[13px] font-medium text-ink">
                              {prealerta.cliente?.nombre ?? 'Sin cliente'}
                            </p>
                            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                              {prealerta.cliente?.casillero ?? 'Sin casillero'}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-[12px] text-ink">{prealerta.tienda}</td>
                          <td className="max-w-[200px] px-4 py-3">
                            <p className="truncate text-[12px] text-muted">{prealerta.descripcion}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-[10px] text-muted">
                            {prealerta.trackingTienda ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <PrealertaBadge estado={prealerta.estado} />
                          </td>
                          <td className="px-4 py-3 font-mono text-[10px] text-muted">
                            {formatFecha(prealerta.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {prealerta.estado === 'PENDIENTE' ? (
                              <button
                                type="button"
                                onClick={() => abrirRecepcion(prealerta)}
                                className="btn btn-primary btn-sm"
                              >
                                <Icon name="package" size={12} />
                                Recibir
                              </button>
                            ) : (
                              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                                {prealerta.estado === 'RECIBIDA' ? 'Registrada' : '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-4 border-l-2 border-gold bg-gold/[0.07] px-4 py-3 font-mono text-[8px] uppercase leading-relaxed tracking-[0.1em] text-ink/70">
                Recibir una prealerta abre el registro de recepción con el cliente ya vinculado. El
                costo se calcula en el servidor y el aviso de WhatsApp sale automáticamente.
              </p>
            </section>
          )}

          {vista === 'ESCANNER' && (
            <section aria-labelledby="titulo-escaner">
              <div className="mb-4">
                <p className="eyebrow">§ 03 / Recepción física</p>
                <h2 id="titulo-escaner" className="display-md mt-2">
                  Escáner de guías
                </h2>
                <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted">
                  Escanea el código de barras del paquete, confirma la ficha y adjunta la evidencia
                  fotográfica comprimida.
                </p>
              </div>
              <Scanner
                onActualizado={() => {
                  refrescarTodo();
                }}
                onAbrirFicha={(paquete) => setPaqueteActivo(paquete)}
              />
            </section>
          )}
        </div>

        <footer className="border-t border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 font-mono text-[8px] uppercase tracking-[0.12em] text-muted sm:px-6 lg:px-8">
            <span>© 2026 Venvios Express · Consola interna</span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="lock" size={11} />
              Datos de contacto restringidos por política
            </span>
          </div>
        </footer>
      </main>

      {/* Sobrepuestos */}
      <ReceptionModal
        abierto={recepcionAbierta}
        prealerta={prealertaRecepcion}
        onCerrar={() => setRecepcionAbierta(false)}
        onCreado={(paquete) => {
          setRecepcionAbierta(false);
          mostrarToast(`Guía ${paquete.guia} registrada y notificada al cliente.`);
          refrescarTodo();
          setVista('PAQUETES');
          setPaqueteActivo(paquete);
        }}
      />

      <PackageDrawer
        paquete={paqueteActivo}
        onCerrar={() => setPaqueteActivo(null)}
        onActualizado={(paquete) => {
          setPaquetes((previos) =>
            previos.map((item) => (item.id === paquete.id ? paquete : item)),
          );
          setPaqueteActivo(paquete);
          void cargarResumen();
          mostrarToast(`Guía ${paquete.guia} actualizada a ${paquete.estado.replace('_', ' ')}.`);
        }}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-[60] w-full max-w-md -translate-x-1/2 px-4"
        >
          <div className="flex items-start gap-2.5 border border-navy bg-navy px-4 py-3 text-paper shadow-[4px_4px_0_rgba(11,28,60,0.25)]">
            <Icon name="check" size={15} className="mt-0.5 shrink-0 text-gold" />
            <p className="text-[12px] leading-snug">{toast}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-auto shrink-0 text-paper/60 transition-colors hover:text-paper"
              aria-label="Cerrar aviso"
            >
              <Icon name="close" size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
