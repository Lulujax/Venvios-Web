import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FiBell, FiCreditCard, FiHome, FiLogOut, FiPackage, FiPlus } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { BotonWhatsAppFlotante } from '../../components/CuentaPiezas';
import { Marca } from '../../components/ui';
import { useAuth } from '../../lib/auth';

interface Seccion {
  a: string;
  texto: string;
  icono: IconType;
  fin?: boolean;
}

const SECCIONES: Seccion[] = [
  { a: '/cuenta', texto: 'Inicio', icono: FiHome, fin: true },
  { a: '/cuenta/pedidos', texto: 'Pedidos', icono: FiPackage },
  { a: '/cuenta/alertas', texto: 'Alertas', icono: FiBell },
  { a: '/cuenta/finanzas', texto: 'Finanzas', icono: FiCreditCard },
];

export function CuentaLayout() {
  const { usuario, salir } = useAuth();
  const navegar = useNavigate();
  const cerrarSesion = async () => {
    await salir();
    navegar('/');
  };

  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-linea bg-white lg:flex lg:flex-col lg:justify-between lg:p-5">
        <div>
          <Link to="/cuenta" className="mb-8 block"><Marca /></Link>
          <nav className="space-y-1" aria-label="Mi cuenta">
            {SECCIONES.map((s) => (
              <NavLink key={s.a} to={s.a} end={s.fin} className={({ isActive }) => `flex min-h-[46px] items-center gap-3 rounded-2xl px-4 text-sm font-bold ${isActive ? 'bg-marino text-white' : 'text-marino hover:bg-marino-50'}`}>
                <s.icono aria-hidden className="text-lg" /> {s.texto}
              </NavLink>
            ))}
          </nav>
          <Link to="/cuenta/nuevo" className="btn btn-acento mt-6 w-full"><FiPlus aria-hidden /> Crear alerta</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="truncate font-bold">{usuario?.nombre}</p>
          <p className="codigo text-suave">{usuario?.codigo}</p>
          <button type="button" className="btn btn-suave btn-chico w-full" onClick={cerrarSesion}><FiLogOut aria-hidden /> Salir</button>
        </div>
      </aside>

      <div className="min-w-0 bg-papel pb-24 lg:pb-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-linea bg-papel/95 px-4 backdrop-blur lg:hidden">
          <Link to="/cuenta" aria-label="Inicio de mi cuenta"><Marca /></Link>
          <button type="button" className="btn btn-suave btn-chico" onClick={cerrarSesion} aria-label="Salir"><FiLogOut aria-hidden /></button>
        </header>
        <Outlet />
      </div>

      <nav className="zona-segura-abajo fixed inset-x-0 bottom-0 z-40 border-t border-linea bg-white lg:hidden" aria-label="Mi cuenta">
        <ul className="mx-auto flex max-w-lg items-stretch justify-around">
          {SECCIONES.map((s) => (
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
      <BotonWhatsAppFlotante />
    </div>
  );
}
