import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { FiArchive, FiCamera, FiCreditCard, FiHome, FiList, FiLogOut, FiPlus, FiSettings } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { Alerta, Cargando, ErrorCarga, InsigniaEstado, Marca, Vacio } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { ETIQUETAS_ESTADO, formatearUsd, nombreTransportista, primerNombre } from '../../lib/formato';
import type { Envio, EstadoEnvio, Resumen, TasaVista } from '../../lib/tipos';
import { useCarga } from '../../lib/useCarga';

interface Seccion {
  a: string;
  texto: string;
  icono: IconType;
  fin?: boolean;
}

export function PanelLayout() {
  const { usuario, salir } = useAuth();
  const navegar = useNavigate();
  const secciones: Seccion[] = [
    { a: '/panel', texto: 'Inicio', icono: FiHome, fin: true },
    { a: '/panel/escanear', texto: 'Registrar', icono: FiCamera },
    { a: '/panel/bodega', texto: 'Bodega', icono: FiArchive },
    { a: '/panel/envios', texto: 'Envíos', icono: FiList },
    { a: '/panel/pagos', texto: 'Pagos', icono: FiCreditCard },
  ];
  if (usuario?.rol === 'ADMIN') secciones.push({ a: '/panel/admin', texto: 'Admin', icono: FiSettings });

  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="hidden border-r border-linea bg-white lg:flex lg:flex-col lg:justify-between lg:p-5">
        <div>
          <Link to="/panel" className="mb-8 block"><Marca /></Link>
          <nav className="space-y-1" aria-label="Panel">
            {secciones.map((s) => (
              <NavLink key={s.a} to={s.a} end={s.fin} className={({ isActive }) => `flex min-h-[46px] items-center gap-3 rounded-2xl px-4 text-sm font-bold ${isActive ? 'bg-marino text-white' : 'text-marino hover:bg-marino-50'}`}>
                <s.icono aria-hidden className="text-lg" /> {s.texto}
              </NavLink>
            ))}
          </nav>
          <Link to="/panel/nuevo" className="btn btn-acento mt-6 w-full"><FiPlus aria-hidden /> Nueva prealerta</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-bold">{usuario?.nombre}</p>
          <p className="text-suave">{usuario?.rol === 'ADMIN' ? 'Administrador' : 'Operador'}</p>
          <button type="button" className="btn btn-suave btn-chico w-full" onClick={async () => { await salir(); navegar('/'); }}><FiLogOut aria-hidden /> Salir</button>
        </div>
      </aside>

      <div className="min-w-0 pb-24 lg:pb-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-linea bg-papel/95 px-4 backdrop-blur lg:hidden">
          <Link to="/panel" aria-label="Inicio del panel"><Marca /></Link>
          <button type="button" className="btn btn-suave btn-chico" onClick={async () => { await salir(); navegar('/'); }} aria-label="Salir"><FiLogOut aria-hidden /></button>
        </header>
        <Outlet />
      </div>

      <nav className="zona-segura-abajo fixed inset-x-0 bottom-0 z-40 border-t border-linea bg-white lg:hidden" aria-label="Panel">
        <ul className="mx-auto flex max-w-lg items-stretch justify-around">
          {secciones.map((s) => (
            <li key={s.a} className="flex-1">
              <NavLink to={s.a} end={s.fin} className={({ isActive }) => `flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${isActive ? 'text-marino' : 'text-suave'}`}>
                {({ isActive }) => (
                  <>
                    <span className={`grid h-7 w-12 place-items-center rounded-full text-lg ${isActive ? 'bg-oro text-marino-900' : ''}`}><s.icono aria-hidden /></span>
                    {s.texto}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

const TARJETAS: Array<{ clave: keyof Resumen; texto: string; a: string; tono: string }> = [
  { clave: 'porRecibir', texto: 'Paquetes por recibir', a: '/panel/envios?estado=PREALERTADO', tono: 'bg-marino-100 text-marino' },
  { clave: 'porAvisar', texto: 'Llegados sin avisar', a: '/panel/bodega', tono: 'bg-oro-100 text-marino-900' },
  { clave: 'sinDueno', texto: 'Sin dueño en bodega', a: '/panel/bodega?sinDueno=1', tono: 'bg-rojo-100 text-rojo-700' },
  { clave: 'porConsolidar', texto: 'Por pesar y cotizar', a: '/panel/envios?estado=POR_CONSOLIDAR', tono: 'bg-marino text-white' },
  { clave: 'porCobrar', texto: 'Por pagar', a: '/panel/envios?estado=POR_PAGAR', tono: 'bg-oro text-marino-900' },
  { clave: 'pagosPorConfirmar', texto: 'Pagos por revisar', a: '/panel/pagos', tono: 'bg-rojo-100 text-rojo-700' },
  { clave: 'porDespachar', texto: 'Enviando: falta la guía', a: '/panel/envios?estado=PAGADO', tono: 'bg-verde-100 text-verde' },
  { clave: 'enBodega', texto: 'Paquetes en bodega', a: '/panel/bodega', tono: 'bg-white text-marino-900 border border-linea' },
];

export function Inicio() {
  const { usuario } = useAuth();
  const resumen = useCarga(() => api.get<Resumen>('/staff/resumen'));
  const info = useCarga(() => api.get<{ tasa: TasaVista | null }>('/publico/info'));

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-rojo">Hoy en la oficina</p>
      <h1 className="mb-6 text-3xl sm:text-4xl">Hola, {usuario ? primerNombre(usuario.nombre) : ''}</h1>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Link to="/panel/escanear" className="btn btn-primario min-h-[64px] text-lg"><FiCamera aria-hidden /> Registrar un paquete</Link>
        <Link to="/panel/nuevo" className="btn btn-suave min-h-[64px] text-lg"><FiPlus aria-hidden /> Nueva prealerta</Link>
      </div>

      {info.datos?.tasa && (
        <p className={`mb-5 rounded-2xl px-4 py-3 text-sm font-bold ${info.datos.tasa.desactualizada ? 'bg-oro-100 text-marino-900' : 'bg-marino-50 text-marino'}`}>
          Tasa BCV: {info.datos.tasa.bolivaresPorUsd.toFixed(2)} Bs por dólar · {info.datos.tasa.fecha}{info.datos.tasa.desactualizada ? ' (no es la de hoy: avisa al administrador)' : ''}
        </p>
      )}
      {info.datos && !info.datos.tasa && <Alerta tono="error" className="mb-5">No hay tasa BCV cargada. Pide al administrador que la cargue.</Alerta>}

      {resumen.cargando && <Cargando />}
      {resumen.error && <ErrorCarga mensaje={resumen.error} reintentar={() => void resumen.recargar()} />}
      {resumen.datos && (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {TARJETAS.map((t) => (
            <li key={t.clave}>
              <Link to={t.a} className={`block rounded-tarjeta p-4 transition active:scale-[0.98] sm:p-5 ${t.tono}`}>
                <p className="font-display text-4xl font-extrabold">{resumen.datos![t.clave]}</p>
                <p className="mt-1 text-sm font-bold">{t.texto}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ListaEnvios() {
  const [params, setParams] = useSearchParams();
  const estado = params.get('estado') ?? '';
  const q = params.get('q') ?? '';
  const consulta = new URLSearchParams();
  if (estado) consulta.set('estado', estado);
  if (q) consulta.set('q', q);
  const { datos, cargando, error, recargar } = useCarga(() => api.get<{ envios: Envio[] }>(`/envios?${consulta.toString()}`).then((r) => r.envios), [estado, q]);

  const cambiar = (clave: string, valor: string) => {
    const nuevos = new URLSearchParams(params);
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    setParams(nuevos, { replace: true });
  };

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Envíos</h1>
        <Link to="/panel/nuevo" className="btn btn-primario btn-chico"><FiPlus aria-hidden /> Nueva prealerta</Link>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_220px]">
        <div>
          <label htmlFor="buscar-envios" className="sr-only">Buscar</label>
          <input id="buscar-envios" className="campo" type="search" placeholder="Buscar por nombre, teléfono, tracking o guía" defaultValue={q} onChange={(e) => cambiar('q', e.target.value)} />
        </div>
        <div>
          <label htmlFor="filtro-estado" className="sr-only">Estado</label>
          <select id="filtro-estado" className="campo" value={estado} onChange={(e) => cambiar('estado', e.target.value)}>
            <option value="">Todos los estados</option>
            {(Object.keys(ETIQUETAS_ESTADO) as EstadoEnvio[]).map((e) => <option key={e} value={e}>{ETIQUETAS_ESTADO[e]}</option>)}
          </select>
        </div>
      </div>

      {cargando && <Cargando />}
      {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
      {datos && datos.length === 0 && <Vacio titulo="No hay envíos con esos filtros" texto="Prueba con otro estado o borra la búsqueda." />}
      <ul className="space-y-3">
        {datos?.map((envio) => (
          <li key={envio.id}>
            <Link to={`/panel/envios/${envio.id}`} className="tarjeta block p-4 transition hover:border-marino/40">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-bold text-marino-900">{envio.cliente.nombre}</p>
                  <p className="codigo truncate text-suave">{envio.paquetes.map((p) => p.tracking).join(' · ')}</p>
                </div>
                <InsigniaEstado estado={envio.estado} />
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm text-suave">
                <span>{envio.paquetes.filter((p) => p.recibido).length}/{envio.paquetes.length} llegaron · {nombreTransportista(envio.transportista)} · {envio.modalidad === 'M2' ? 'Cobro a destino' : 'Todo incluido'}</span>
                {envio.precio && <b className="text-marino-900">{formatearUsd(envio.precio.totalCentavos)}</b>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SinPermiso() {
  return <div className="contenedor py-10"><Alerta tono="error">No tienes permiso para ver esta sección.</Alerta></div>;
}
