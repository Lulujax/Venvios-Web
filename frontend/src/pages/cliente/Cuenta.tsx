import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FiBriefcase, FiSearch, FiCreditCard, FiHome, FiLayers, FiLogOut, FiPackage, FiPlus, FiUser } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { BotonWhatsAppFlotante } from '../../components/CuentaPiezas';
import { BotonMenu, MenuDesplegable, useMenuDesplegable } from '../../components/MenuDesplegable';
import { Marca } from '../../components/ui';
import { esPersonal, useAuth } from '../../lib/auth';

interface Seccion {
  a: string;
  texto: string;
  icono: IconType;
  fin?: boolean;
}

const SECCIONES: Seccion[] = [
  { a: '/cuenta', texto: 'Inicio', icono: FiHome, fin: true },
  { a: '/cuenta/mis-envios', texto: 'Mis envíos', icono: FiPackage },
  { a: '/cuenta/rastrear', texto: 'Rastrear', icono: FiSearch },
  { a: '/cuenta/consolidar', texto: 'Consolidar', icono: FiLayers },
  { a: '/cuenta/finanzas', texto: 'Finanzas', icono: FiCreditCard },
];

export function CuentaLayout() {
  const { usuario, salir } = useAuth();
  const navegar = useNavigate();
  const menu = useMenuDesplegable();
  const cerrarSesion = async () => {
    await salir();
    navegar('/');
  };

  return (
    <div className="min-h-[100dvh]">
      <MenuDesplegable abierto={menu.abierto} alCerrar={menu.cerrar} etiqueta="Menú de mi cuenta">
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
          <NavLink to="/cuenta/perfil" className={({ isActive }) => `mt-3 flex min-h-[46px] items-center gap-3 rounded-2xl px-4 text-sm font-bold ${isActive ? 'bg-marino text-white' : 'text-marino hover:bg-marino-50'}`}>
            <FiUser aria-hidden className="text-lg" /> Mi perfil
          </NavLink>
          {esPersonal(usuario?.rol) && <Link to="/panel" className="btn btn-suave mt-3 w-full"><FiBriefcase aria-hidden /> Ir al panel de trabajo</Link>}
        </div>
        <div className="space-y-2 text-sm">
          <p className="truncate font-bold">{usuario?.nombre}</p>
          <p className="codigo text-suave">{usuario?.codigo}</p>
          <button type="button" className="btn btn-suave btn-chico w-full" onClick={cerrarSesion}><FiLogOut aria-hidden /> Salir</button>
        </div>
      </MenuDesplegable>

      <div className="min-w-0 bg-papel pb-24 lg:pb-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-linea bg-papel/95 px-4 backdrop-blur lg:h-16 lg:px-8">
          <div className="flex items-center gap-3">
            <BotonMenu alAbrir={menu.abrir} />
            <Link to="/cuenta" aria-label="Inicio de mi cuenta"><Marca /></Link>
          </div>
          <div className="flex items-center gap-2">
            {esPersonal(usuario?.rol) && <Link to="/panel" className="btn btn-suave btn-chico"><FiBriefcase aria-hidden /> Panel</Link>}
            <Link to="/cuenta/perfil" className="btn btn-suave btn-chico" aria-label="Mi perfil"><FiUser aria-hidden /></Link>
            <button type="button" className="btn btn-suave btn-chico" onClick={cerrarSesion} aria-label="Salir"><FiLogOut aria-hidden /></button>
          </div>
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
