import { Link } from 'react-router-dom';
import { BRAND, whatsappLink } from '../../config/brand';
import { cn } from '../../lib/cn';
import { Icon } from '../ui/Icon';
import { Reveal } from '../Reveal';

const CAPACIDADES = ['Casillero único', 'Prealerta digital', 'Aviso por WhatsApp'];

const MANIFIESTO = [
  { n: '01', clave: 'Ruta', valor: 'Cúcuta → Venezuela' },
  { n: '02', clave: 'Recepción', valor: 'Barrio Latino, Centro' },
  { n: '03', clave: 'Entrega', valor: 'Puerta a puerta' },
  { n: '04', clave: 'Atención', valor: BRAND.whatsappDisplay, href: whatsappLink() },
];

function GridOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 mx-auto hidden max-w-shell grid-cols-12 px-5 sm:px-8 lg:grid lg:px-12"
      aria-hidden="true"
    >
      {Array.from({ length: 12 }).map((_, index) => (
        <div key={index} className="border-l border-ink/[0.05] last:border-r" />
      ))}
    </div>
  );
}

function FotoRuta() {
  return (
    <figure className="relative mx-auto mb-7 w-full max-w-[360px] lg:mb-1 lg:rotate-[1.4deg]">
      <div
        className="absolute -left-2.5 -top-2.5 h-full w-full border border-gold/60"
        aria-hidden="true"
      />
      <div className="relative border border-line bg-white">
        <div className="relative overflow-hidden">
          <img
            src="/img/ruta.jpg"
            alt="Camión de carga en la carretera de montaña de la ruta Cúcuta — Venezuela"
            className="aspect-[3/2] w-full object-cover saturate-[0.85] contrast-[1.02]"
            draggable={false}
          />
          <span className="stamp absolute right-3 top-3 rotate-2 bg-paper">Ruta diaria</span>
        </div>
        <figcaption className="flex items-center justify-between gap-3 border-t border-line px-3.5 py-2.5">
          <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-muted">
            FIG. 00 / Carretera CUC → VE
          </span>
          <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.15em] text-muted">
            Puerta a puerta
          </span>
        </figcaption>
      </div>
    </figure>
  );
}

function ManifiestoCard() {
  return (
    <div className="relative mx-auto w-full max-w-[360px] lg:mt-6">
      <div className="absolute -right-3 -top-3 h-full w-full border border-navy/20 bg-bone" aria-hidden="true" />
      <div className="hatch absolute -bottom-6 -left-5 hidden h-28 w-28 lg:block" aria-hidden="true" />

      <article className="waybill relative z-10 lg:-rotate-[1.2deg]">
        <header className="flex items-start justify-between gap-3 bg-navy px-4 py-3.5 text-paper">
          <div>
            <p className="font-display text-[15px] font-extrabold leading-none tracking-tight">
              VENVIOS EXPRESS
            </p>
            <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.24em] text-paper/55">
              Waybill / Manifiesto de carga
            </p>
          </div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold">001</p>
        </header>

        <div className="px-4 pb-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="meta">N.º de guía</p>
              <p className="mt-1 font-mono text-[17px] font-medium tracking-tight">VEX-2026-04217</p>
            </div>
            <span className="stamp -rotate-3">En ruta</span>
          </div>

          <div className="mt-5 grid grid-cols-2 divide-x divide-ink/15 border-y border-ink/15">
            <div className="py-3 pr-3">
              <p className="meta">Origen</p>
              <p className="mt-1 font-mono text-[11px]">Cúcuta, CO</p>
              <p className="font-mono text-[9px] text-muted">CUC · Colombia</p>
            </div>
            <div className="py-3 pl-3">
              <p className="meta">Destino</p>
              <p className="mt-1 font-mono text-[11px]">Venezuela, VE</p>
              <p className="font-mono text-[9px] text-muted">Puerta a puerta</p>
            </div>
          </div>

          <dl className="mt-4 space-y-2 font-mono text-[10px]">
            <div className="flex items-center justify-between gap-4">
              <dt className="uppercase tracking-[0.12em] text-muted">Servicio</dt>
              <dd>Puerta a puerta</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="uppercase tracking-[0.12em] text-muted">Peso cobrable</dt>
              <dd>6,0 kg</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="uppercase tracking-[0.12em] text-muted">Estado</dt>
              <dd className="flex items-center gap-1.5 text-gold">
                <span className="h-1.5 w-1.5 bg-gold" aria-hidden="true" />
                En tránsito
              </dd>
            </div>
          </dl>

          <div className="mt-5">
            <div className="barcode text-ink" aria-hidden="true" />
            <div className="mt-2 flex items-center justify-between font-mono text-[8px] tracking-[0.18em] text-muted">
              <span>VEX-2026-04217</span>
              <span>04217</span>
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between gap-4 border-t border-dashed border-ink/25 pt-3">
            <div>
              <p className="meta">Sede de recepción</p>
              <p className="mt-1 text-[11px] leading-snug text-ink">
                Barrio Latino, Centro
                <br />
                Cúcuta, Colombia
              </p>
            </div>
            <p className="text-right font-display text-[13px] font-bold leading-[1.05] text-navy">
              Tu mejor
              <br />
              opción.
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative flex min-h-[100dvh] flex-col overflow-hidden border-b border-line">
      <GridOverlay />

      <div className="shell relative flex flex-1 items-center py-12 lg:py-16">
        <div className="grid w-full gap-14 lg:grid-cols-12 lg:gap-0">
          <div className="lg:col-span-7 lg:pr-12">
            <Reveal>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 pb-4">
                <p className="eyebrow flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-red" aria-hidden="true" />
                  Manifiesto 001 · Recepción Cúcuta
                </p>
                <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted">
                  Tu mejor opción
                </p>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="display-xl mt-8 max-w-[15ch] text-balance">
                Tu mejor{' '}
                <span className="relative inline-block">
                  opción
                  <span className="absolute -bottom-1 left-0 h-[5px] w-full bg-gold" aria-hidden="true" />
                </span>{' '}
                para enviar de Colombia a Venezuela
              </h1>
            </Reveal>

            <Reveal delay={150}>
              <p className="mt-7 max-w-[48ch] text-base leading-relaxed text-muted sm:text-[17px]">
                Recibimos tus compras en Cúcuta y las entregamos puerta a puerta. Rápido, seguro y
                100% digital.
              </p>
            </Reveal>

            <Reveal delay={220}>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link to="/login?modo=registro" className="btn btn-primary">
                  Crear mi casillero
                  <Icon name="arrowUpRight" size={14} />
                </Link>
                <Link to="/rastreo" className="btn btn-outline">
                  Rastrear paquete
                  <Icon name="search" size={14} />
                </Link>
              </div>
            </Reveal>

            <Reveal delay={280}>
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-l-2 border-gold pl-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink/60">
                  Sin tarifas aéreas ni marítimas
                </p>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink/60">
                  Una tarifa por paquete
                </p>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2">
                {CAPACIDADES.map((item, index) => (
                  <span key={item} className="flex items-center gap-3">
                    {index > 0 && <span className="h-3 w-px bg-line" aria-hidden="true" />}
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                      {item}
                    </span>
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-5 lg:pl-2">
            <Reveal delay={100}>
              <FotoRuta />
            </Reveal>
            <Reveal delay={220}>
              <ManifiestoCard />
            </Reveal>
            <Reveal delay={320}>
              <p className="mx-auto mt-8 max-w-[360px] font-mono text-[9px] uppercase leading-relaxed tracking-[0.14em] text-muted lg:pl-2">
                De Cúcuta al destino final. Tu paquete se pesa, se fotografía y se notifica antes de
                salir.
              </p>
            </Reveal>
          </div>
        </div>
      </div>

      <div className="relative border-t border-line bg-paper">
        <div className="shell grid grid-cols-2 lg:grid-cols-4">
          {MANIFIESTO.map((item, index) => {
            const contenido = (
              <>
                <span className="font-mono text-[10px] text-gold">{item.n}</span>
                <span className="eyebrow mt-2 block">{item.clave}</span>
                <span className="mt-1 block text-[13px] font-medium leading-snug text-ink">
                  {item.valor}
                </span>
              </>
            );

            return (
              <div
                key={item.n}
                className={cn(
                  'px-4 py-5 sm:px-5 lg:px-6',
                  index > 0 && 'border-t border-ink/10 lg:border-t-0 lg:border-l',
                  index % 2 === 1 && 'border-l',
                  index === 2 && 'border-l-0 lg:border-l',
                )}
              >
                {item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="footer-link block"
                  >
                    {contenido}
                  </a>
                ) : (
                  contenido
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
