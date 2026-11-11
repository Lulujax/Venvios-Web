import { Link } from 'react-router-dom';
import { BRAND, whatsappLink } from '../../config/brand';
import { BrandMark } from '../ui/BrandMark';
import { Icon } from '../ui/Icon';

export function Footer() {
  return (
    <footer className="bg-navy text-paper">
      <div className="h-1 w-full bg-red" />
      <div className="shell py-14 lg:py-20">
        <div className="grid gap-12 border-b border-paper/15 pb-14 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <p className="font-mono text-[10px] uppercase tracking-label text-paper/45">
              § 06 / Cierre de manifiesto
            </p>
            <p className="mt-5 font-display text-[clamp(2.6rem,5vw,4.4rem)] font-extrabold leading-[0.95] tracking-tightest">
              Tu mejor opción<span className="text-gold">.</span>
            </p>
            <p className="mt-5 max-w-[42ch] text-sm leading-relaxed text-paper/60">
              Recibimos tus compras en Cúcuta y las entregamos puerta a puerta en Venezuela. Una
              guía, una tarifa por paquete y aviso por WhatsApp en cada etapa.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login?modo=registro" className="btn btn-gold">
                Crear mi casillero
                <Icon name="arrowUpRight" size={14} />
              </Link>
              <Link to="/rastreo" className="btn btn-outline-light">
                Rastrear paquete
              </Link>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-4 lg:col-start-9 lg:grid-cols-1">
            <div className="border-t border-paper/15 pt-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper/40">
                WhatsApp de atención
              </p>
              <a
                href={whatsappLink('Hola, quiero información sobre un envío a Venezuela.')}
                target="_blank"
                rel="noreferrer"
                className="footer-link mt-2 inline-flex items-center gap-2 font-mono text-base text-gold"
              >
                <Icon name="whatsapp" size={15} />
                {BRAND.whatsappDisplay}
              </a>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-paper/40">
                {BRAND.hours}
              </p>
            </div>

            <div className="border-t border-paper/15 pt-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper/40">
                Sede de recepción
              </p>
              <a
                href="https://maps.google.com/?q=Barrio+Latino+Centro+Cucuta+Colombia"
                target="_blank"
                rel="noreferrer"
                className="footer-link mt-2 flex items-start gap-2 text-sm leading-relaxed text-paper/80"
              >
                <Icon name="pin" size={15} className="mt-0.5 shrink-0 text-gold" />
                <span>
                  {BRAND.address.line1}
                  <br />
                  {BRAND.address.line2}
                </span>
              </a>
            </div>

            <div className="border-t border-paper/15 pt-4 sm:col-span-2 lg:col-span-1">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper/40">
                Redes · {BRAND.handle}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {BRAND.socials.map((red) => (
                  <a
                    key={red.label}
                    href={red.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${BRAND.name} en ${red.label} (${BRAND.handle})`}
                    title={`${red.label} · ${BRAND.handle}`}
                    className="group inline-flex items-center gap-2.5 border border-paper/25 px-3.5 py-2.5 transition-colors duration-200 ease-out hover:border-gold"
                  >
                    <Icon
                      name={red.label.toLowerCase() as 'instagram' | 'facebook' | 'tiktok'}
                      size={16}
                      className="text-paper/85 transition-colors duration-200 ease-out group-hover:text-gold"
                    />
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper/85 transition-colors duration-200 ease-out group-hover:text-paper">
                      {red.label}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-8 pt-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-4">
            <BrandMark light />
            <p className="mt-4 font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-paper/35">
              Ruta Colombia → Venezuela · Puerta a puerta
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 font-mono text-[9px] uppercase tracking-[0.12em] text-paper/35 lg:col-span-8 lg:justify-end">
            <span>© 2026 Venvios Express</span>
            <span>Barrio Latino · Cúcuta</span>
            <span>Set in Cabinet Grotesk, Satoshi & JetBrains Mono</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
