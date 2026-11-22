import type { CSSProperties, ReactNode } from 'react';
import { FaFacebookF, FaInstagram, FaTiktok, FaWhatsapp } from 'react-icons/fa';
import { FiArrowUpRight, FiClock, FiMail, FiMapPin } from 'react-icons/fi';
import { Link, useLocation } from 'react-router-dom';
import type { Contacto } from '../lib/tipos';
import { EnlaceExterno } from './EnlaceExterno';
import { Marca } from './ui';

const SITIO_AUTOR = 'https://lulujax.netlify.app/';
const NOMBRE_AUTOR = 'Lulujax';

function EnlaceSeccion({ ancla, className = '', children }: { ancla: string; className?: string; children: ReactNode }) {
  const { pathname } = useLocation();
  const destino = pathname === '/' ? `#${ancla}` : `/#${ancla}`;
  const estilo = className || 'text-white/70 transition hover:text-oro hover:underline underline-offset-4';
  return (
    <a href={destino} className={estilo}>
      {children}
    </a>
  );
}

function Columna({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-oro">{titulo}</h2>
      <ul className="mt-4 space-y-2.5 text-sm">{children}</ul>
    </div>
  );
}

function RedSocial({ href, etiqueta, children }: { href: string; etiqueta: string; children: ReactNode }) {
  return (
    <EnlaceExterno
      href={href}
      aria-label={etiqueta}
      className="grid h-11 w-11 place-items-center rounded-full border border-white/25 text-white/80 transition hover:border-oro hover:bg-white/10 hover:text-white"
    >
      {children}
    </EnlaceExterno>
  );
}

function Firma() {
  return (
    <div className="mt-6 border-t border-white/10 pt-6">
      <p className="animate-entrar flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
        <span className="hidden h-px w-10 bg-gradient-to-r from-transparent to-oro/50 sm:block" aria-hidden />
        <span>Desarrollado por</span>
        <EnlaceExterno href={SITIO_AUTOR} className="firma" aria-label="Lulujax">
          <span className="firma-marca" aria-hidden>{'</>'}</span>
          <span className="firma-nombre" aria-hidden>
            {NOMBRE_AUTOR.split('').map((letra, indice) => (
              <span key={indice} className="firma-letra" style={{ '--i': indice } as CSSProperties}>{letra}</span>
            ))}
          </span>
          <FiArrowUpRight className="firma-flecha" aria-hidden />
        </EnlaceExterno>
        <span className="hidden h-px w-10 bg-gradient-to-l from-transparent to-oro/50 sm:block" aria-hidden />
      </p>
    </div>
  );
}

export function Pie({ contacto }: { contacto?: Contacto | null }) {
  const anio = new Date().getFullYear();
  const whatsapp = contacto?.whatsapp
    ? `https://wa.me/${contacto.whatsapp}?text=${encodeURIComponent('Hola Venvios Express, quiero información sobre el casillero.')}`
    : null;

  return (
    <footer className="border-t border-white/10 bg-marino-900 text-white">
      <div className="contenedor py-12 sm:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Link to="/" aria-label="Venvios Express, inicio">
              <Marca claro />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">
              Casillero internacional de Colombia a Venezuela. Recibimos tus compras en Cúcuta y las llevamos hasta tu casa.
            </p>
            {contacto && (
              <div className="mt-5 flex flex-wrap gap-2">
                <RedSocial href={contacto.instagram} etiqueta="Instagram"><FaInstagram aria-hidden /></RedSocial>
                <RedSocial href={contacto.facebook} etiqueta="Facebook"><FaFacebookF aria-hidden /></RedSocial>
                <RedSocial href={contacto.tiktok} etiqueta="TikTok"><FaTiktok aria-hidden /></RedSocial>
                {whatsapp && (
                  <RedSocial href={whatsapp} etiqueta="WhatsApp de atención"><FaWhatsapp aria-hidden /></RedSocial>
                )}
              </div>
            )}
          </div>

          <Columna titulo="Servicios">
            <li><EnlaceSeccion ancla="tarifas">Tarifas</EnlaceSeccion></li>
            <li><EnlaceSeccion ancla="calculadora">Calculadora</EnlaceSeccion></li>
            <li><EnlaceSeccion ancla="rastreo">Rastrear envío</EnlaceSeccion></li>
            <li><Link to="/registro" className="text-white/70 transition hover:text-oro hover:underline underline-offset-4">Crear cuenta</Link></li>
          </Columna>

          <Columna titulo="Ayuda">
            <li><EnlaceSeccion ancla="como-funciona">Cómo funciona</EnlaceSeccion></li>
            <li><EnlaceSeccion ancla="contacto">Contacto</EnlaceSeccion></li>
            {whatsapp && (
              <li>
                <EnlaceExterno href={whatsapp} className="inline-flex items-center gap-2 text-white/70 transition hover:text-oro hover:underline underline-offset-4">
                  <FaWhatsapp aria-hidden className="text-base" /> Escríbenos por WhatsApp
                </EnlaceExterno>
              </li>
            )}
          </Columna>

          <Columna titulo="Legal y pagos">
            <li><Link to="/terminos" className="text-white/70 transition hover:text-oro hover:underline underline-offset-4">Términos y condiciones</Link></li>
            <li><Link to="/privacidad" className="text-white/70 transition hover:text-oro hover:underline underline-offset-4">Política de privacidad</Link></li>
            <li className="text-white/50">Pagos en Bs a tasa BCV</li>
          </Columna>
        </div>

        <div className="mt-10 flex flex-col gap-5 border-t border-white/15 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-xl text-white">¿Cuánto cuesta tu compra?</p>
            <p className="mt-1 text-sm text-white/60">Precios en dólares, con el equivalente en bolívares del día.</p>
          </div>
          <EnlaceSeccion ancla="calculadora" className="btn btn-acento">Calcula tu envío</EnlaceSeccion>
        </div>
      </div>

      <div className="border-t border-white/10 bg-black/25">
        <div className="contenedor py-6">
          <div className="flex flex-col gap-2.5 text-xs text-white/60 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p>© {anio} Venvios Express. Todos los derechos reservados.</p>
            {contacto && (
              <p className="flex items-start gap-1.5">
                <FiMapPin aria-hidden className="mt-0.5 shrink-0" />
                <span>{contacto.direccion}</span>
              </p>
            )}
            {contacto?.horario && (
              <p className="flex items-start gap-1.5">
                <FiClock aria-hidden className="mt-0.5 shrink-0" />
                <span>{contacto.horario}</span>
              </p>
            )}
            {contacto?.correo && (
              <a href={`mailto:${contacto.correo}`} className="inline-flex items-center gap-1.5 hover:text-oro hover:underline underline-offset-4">
                <FiMail aria-hidden /> {contacto.correo}
              </a>
            )}
            <p>Precios en dólares · Pagos en Bs a tasa BCV del día</p>
          </div>

          <Firma />
        </div>
      </div>
    </footer>
  );
}