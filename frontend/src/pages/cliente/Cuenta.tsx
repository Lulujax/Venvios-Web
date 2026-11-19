import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FiLogOut, FiPlus } from 'react-icons/fi';
import { InsigniaEstado, Marca, Cargando, ErrorCarga, Vacio } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatearBs, formatearUsd, nombreTransportista, primerNombre } from '../../lib/formato';
import type { Envio } from '../../lib/tipos';
import { useCarga } from '../../lib/useCarga';

export function CuentaLayout() {
  const { usuario, salir } = useAuth();
  const navegar = useNavigate();
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 border-b border-linea bg-papel/95 backdrop-blur">
        <div className="contenedor flex h-16 items-center justify-between gap-3">
          <Link to="/" aria-label="Inicio"><Marca /></Link>
          <nav className="flex items-center gap-1 text-sm font-bold" aria-label="Mi cuenta">
            <NavLink to="/cuenta" end className={({ isActive }) => `rounded-full px-3 py-2 ${isActive ? 'bg-marino text-white' : 'text-marino'}`}>Mis envíos</NavLink>
            <NavLink to="/cuenta/nuevo" className={({ isActive }) => `rounded-full px-3 py-2 ${isActive ? 'bg-marino text-white' : 'text-marino'}`}>Nuevo</NavLink>
            <button type="button" className="btn btn-suave btn-chico ml-1" onClick={async () => { await salir(); navegar('/'); }} aria-label={`Salir (${usuario?.nombre ?? ''})`}><FiLogOut aria-hidden /><span className="hidden sm:inline">Salir</span></button>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

export function MisEnvios() {
  const { usuario } = useAuth();
  const { datos, cargando, error, recargar } = useCarga(() => api.get<{ envios: Envio[] }>('/envios').then((r) => r.envios));

  return (
    <div className="contenedor py-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-rojo">Mi casillero</p>
          <h1 className="text-3xl sm:text-4xl">Hola, {usuario ? primerNombre(usuario.nombre) : ''}</h1>
        </div>
        <Link to="/cuenta/nuevo" className="btn btn-primario"><FiPlus aria-hidden /> Registrar paquetes</Link>
      </div>

      <div className="mb-6 rounded-tarjeta bg-marino-900 p-5 text-white">
        <p className="text-sm text-white/70">Dirección de tu casillero</p>
        <p className="mt-1 font-display text-xl font-bold">Venvios Express · {usuario?.nombre}</p>
        <p className="text-sm text-white/80">Av. 3 #8-03, piso 2, local 02, sector Centro, Barrio Latino, Cúcuta</p>
        <p className="mt-2 text-xs text-white/60">Pon tu nombre completo en el paquete para que lo identifiquemos.</p>
      </div>

      {cargando && <Cargando />}
      {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
      {datos && datos.length === 0 && <Vacio titulo="Aún no tienes paquetes" texto="Registra el tracking de tus compras y te avisamos cuando lleguen a Cúcuta." accion={<Link to="/cuenta/nuevo" className="btn btn-primario">Registrar mi primer paquete</Link>} />}
      <ul className="space-y-3">
        {datos?.map((envio) => (
          <li key={envio.id}>
            <Link to={`/cuenta/envios/${envio.id}`} className="tarjeta block p-4 transition hover:border-marino/40 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold text-marino-900">{envio.tienda === 'Sin prealerta' ? 'Paquete sin prealerta' : envio.tienda}</p>
                  <p className="codigo truncate text-suave">{envio.paquetes.map((p) => p.tracking).join(' · ')}</p>
                </div>
                <InsigniaEstado estado={envio.estado} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-suave">{envio.paquetes.filter((p) => p.recibido).length}/{envio.paquetes.length} llegaron · {nombreTransportista(envio.transportista)}</span>
                {envio.precio && <span className="font-bold text-marino-900">{formatearUsd(envio.precio.totalCentavos)}{envio.precio.totalBsCentavos !== null ? ` · ${formatearBs(envio.precio.totalBsCentavos)}` : ''}</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
