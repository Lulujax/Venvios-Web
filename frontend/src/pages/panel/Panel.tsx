import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FiArchive, FiCamera, FiUser, FiCreditCard, FiHome, FiList, FiLogOut, FiPlus, FiSettings } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { BotonMenu, MenuDesplegable, useMenuDesplegable } from '../../components/MenuDesplegable';
import { Alerta, Cargando, ErrorCarga, Marca } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { primerNombre } from '../../lib/formato';
import type { Resumen, TasaVista } from '../../lib/tipos';
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
  const menu = useMenuDesplegable();
  const secciones: Seccion[] = [
    { a: '/panel', texto: 'Inicio', icono: FiHome, fin: true },
    { a: '/panel/escanear', texto: 'Registrar', icono: FiCamera },
    { a: '/panel/bodega', texto: 'Bodega', icono: FiArchive },
    { a: '/panel/envios', texto: 'Envíos', icono: FiList },
    { a: '/panel/pagos', texto: 'Pagos', icono: FiCreditCard },
  ];
  if (usuario?.rol === 'ADMIN') secciones.push({ a: '/panel/admin', texto: 'Admin', icono: FiSettings });

  return (
    <div className="min-h-[100dvh]">
      <MenuDesplegable abierto={menu.abierto} alCerrar={menu.cerrar} etiqueta="Menú del panel">
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
          <Link to="/cuenta" className="btn btn-suave mt-3 w-full"><FiUser aria-hidden /> Ver como cliente</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-bold">{usuario?.nombre}</p>
          <p className="text-suave">{usuario?.rol === 'ADMIN' ? 'Administrador' : 'Operador'}</p>
          <button type="button" className="btn btn-suave btn-chico w-full" onClick={async () => { await salir(); navegar('/'); }}><FiLogOut aria-hidden /> Salir</button>
        </div>
      </MenuDesplegable>

      <div className="min-w-0 pb-24 lg:pb-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-linea bg-papel/95 px-4 backdrop-blur lg:h-16 lg:px-8">
          <div className="flex items-center gap-3">
            <BotonMenu alAbrir={menu.abrir} />
            <Link to="/panel" aria-label="Inicio del panel"><Marca /></Link>
          </div>
          <div className="flex items-center gap-2">
          <Link to="/cuenta" className="btn btn-suave btn-chico"><FiUser aria-hidden /> Vista cliente</Link>
          <button type="button" className="btn btn-suave btn-chico" onClick={async () => { await salir(); navegar('/'); }} aria-label="Salir"><FiLogOut aria-hidden /></button>
          </div>
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

export { ListaEnvios } from './ListaEnvios';
