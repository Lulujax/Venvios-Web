import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BRAND, whatsappLink } from '../../config/brand';
import { Icon } from '../ui/Icon';
import { BrandMark } from '../ui/BrandMark';

const ENLACES = [
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Tarifas', href: '#tarifas' },
  { label: 'Casillero', href: '#casillero' },
];

export function Navbar() {
  const [abierto, setAbierto] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setAbierto(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    document.body.style.overflow = abierto ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [abierto]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper">
      <div className="bg-navy text-paper">
        <div className="shell flex h-9 items-center justify-between">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper/75">
            Cúcuta, Colombia <span className="text-gold">→</span> Venezuela
          </p>
          <a
            href={whatsappLink('Hola, quiero información sobre un envío a Venezuela.')}
            target="_blank"
            rel="noreferrer"
            className="footer-link hidden items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-paper/75 sm:flex"
          >
            <Icon name="whatsapp" size={13} />
            {BRAND.whatsappDisplay}
          </a>
        </div>
      </div>

      <div className="shell flex h-[68px] items-center justify-between gap-6">
        <Link to="/" aria-label="Venvios Express, inicio">
          <BrandMark />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegación principal">
          {ENLACES.map((enlace) => (
            <Link
              key={enlace.href}
              to={`/${enlace.href}`}
              className="footer-link font-mono text-[10px] uppercase tracking-[0.16em] text-ink/70"
            >
              {enlace.label}
            </Link>
          ))}
          <Link
            to="/rastreo"
            className="footer-link font-mono text-[10px] uppercase tracking-[0.16em] text-ink/70"
          >
            Rastreo
          </Link>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link to="/login" className="btn btn-ghost btn-sm">
            Ingresar
          </Link>
          <Link to="/login?modo=registro" className="btn btn-primary btn-sm">
            Crear mi casillero
            <Icon name="arrowUpRight" size={13} />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setAbierto((valor) => !valor)}
          className="grid h-10 w-10 place-items-center border border-line lg:hidden"
          aria-expanded={abierto}
          aria-controls="menu-movil"
          aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
        >
          <Icon name={abierto ? 'close' : 'menu'} size={20} />
        </button>
      </div>

      {abierto && (
        <div id="menu-movil" className="border-t border-line bg-paper lg:hidden">
          <nav className="shell flex flex-col py-4" aria-label="Navegación móvil">
            {ENLACES.map((enlace) => (
              <Link
                key={enlace.href}
                to={`/${enlace.href}`}
                className="border-b border-line py-4 font-display text-xl font-bold"
              >
                {enlace.label}
              </Link>
            ))}
            <Link to="/rastreo" className="border-b border-line py-4 font-display text-xl font-bold">
              Rastreo de guía
            </Link>
            <div className="mt-5 flex flex-col gap-2">
              <Link to="/login?modo=registro" className="btn btn-primary w-full">
                Crear mi casillero
                <Icon name="arrowUpRight" size={14} />
              </Link>
              <Link to="/login" className="btn btn-outline w-full">
                Ingresar a mi cuenta
              </Link>
            </div>
            <a
              href={whatsappLink('Hola, quiero información sobre un envío a Venezuela.')}
              target="_blank"
              rel="noreferrer"
              className="mt-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-navy"
            >
              <Icon name="whatsapp" size={14} />
              {BRAND.whatsappDisplay}
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
