import { cn } from '../../lib/cn';
import { Reveal } from '../Reveal';

interface Foto {
  src: string;
  alt: string;
  fig: string;
  meta: string;
  stamp?: string;
  stampClass?: string;
  className: string;
  ratio: string;
}

const MOSAICO: Foto[] = [
  {
    src: '/img/recepcion.jpg',
    alt: 'Equipo de operación recibiendo y clasificando cajas en banda transportadora',
    fig: 'FIG. 01 / Recepción y clasificación',
    meta: 'Sede Cúcuta',
    stamp: 'Turno del día',
    stampClass: 'left-3 top-3 -rotate-2',
    className: 'sm:col-span-2 lg:col-span-7',
    ratio: 'aspect-[4/3]',
  },
  {
    src: '/img/registro.jpg',
    alt: 'Operaria registrando paquetes con un checklist en tablero',
    fig: 'FIG. 02 / Registro en manifiesto',
    meta: 'Peso y dimensiones',
    className: 'lg:col-span-5 lg:mt-12',
    ratio: 'aspect-[4/3]',
  },
  {
    src: '/img/caja.jpg',
    alt: 'Caja de cartón abierta para verificar el contenido antes del despacho',
    fig: 'FIG. 03 / Verificación del contenido',
    meta: 'Antes de despachar',
    className: 'lg:col-span-4 lg:mt-6',
    ratio: 'aspect-[4/3]',
  },
  {
    src: '/img/bodega.jpg',
    alt: 'Estantes de bodega con cajas ordenadas por casillero',
    fig: 'FIG. 04 / Bodega',
    meta: 'Barrio Latino · CUC',
    stamp: 'CUC · CO',
    stampClass: 'right-3 top-3 rotate-2',
    className: 'lg:col-span-8',
    ratio: 'aspect-[16/10]',
  },
];

const TIRA: Foto[] = [
  {
    src: '/img/empaque.jpg',
    alt: 'Mesa de trabajo con cajas listas para despacho',
    fig: 'FIG. 05 / Empaque',
    meta: 'Despacho',
    className: '',
    ratio: 'aspect-[4/3]',
  },
  {
    src: '/img/sede.jpg',
    alt: 'Vehículo de reparto estacionado frente a la sede de operación',
    fig: 'FIG. 06 / Sede y reparto',
    meta: 'Cúcuta centro',
    className: '',
    ratio: 'aspect-[4/3]',
  },
  {
    src: '/img/flujobodega.jpg',
    alt: 'Cajas entrando al área de carga en banda transportadora',
    fig: 'FIG. 07 / Flujo de carga',
    meta: 'Todos los días',
    className: '',
    ratio: 'aspect-[4/3]',
  },
];

function FotoCard({ foto, delay = 0 }: { foto: Foto; delay?: number }) {
  return (
    <Reveal delay={delay} className={foto.className}>
      <figure className="group panel overflow-hidden">
        <div className="relative overflow-hidden">
          <img
            src={foto.src}
            alt={foto.alt}
            loading="lazy"
            decoding="async"
            draggable={false}
            className={cn(
              foto.ratio,
              'w-full object-cover saturate-[0.82] contrast-[1.03] transition-transform duration-700 ease-out group-hover:scale-[1.04]',
            )}
          />
          {foto.stamp && (
            <span className={cn('stamp absolute bg-paper', foto.stampClass)}>{foto.stamp}</span>
          )}
        </div>
        <figcaption className="flex items-center justify-between gap-3 border-t border-line px-3.5 py-2.5">
          <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-muted">
            {foto.fig}
          </span>
          <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.15em] text-muted">
            {foto.meta}
          </span>
        </figcaption>
      </figure>
    </Reveal>
  );
}

export function LaOperacion() {
  return (
    <section id="operacion" className="scroll-mt-24 border-b border-line">
      <div className="shell py-20 lg:py-28">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <p className="eyebrow">§ 03 / Registro fotográfico</p>
            <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
              Cúcuta · CO → Venezuela
            </p>
          </div>

          <div className="lg:col-span-7">
            <Reveal>
              <h2 className="display-lg max-w-[18ch] text-balance">
                Esto le pasa a tu paquete, todos los días.
              </h2>
              <p className="mt-5 max-w-[56ch] text-sm leading-relaxed text-muted sm:text-base">
                Recepción, pesaje, bodega y despacho. Cada etapa queda registrada en tu
                cuenta y te llega por WhatsApp — sin filas ni llamadas.
              </p>
            </Reveal>
          </div>

          <div className="hidden text-right lg:col-span-2 lg:block">
            <p className="font-mono text-[52px] leading-none tracking-tight text-line">07</p>
            <p className="meta mt-2">registros</p>
          </div>
        </div>

        <div className="mt-14 grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-12 lg:gap-6">
          {MOSAICO.map((foto, index) => (
            <FotoCard key={foto.src} foto={foto} delay={index * 50} />
          ))}
        </div>

        <div className="mt-5 grid items-start gap-5 sm:grid-cols-3 lg:gap-6">
          {TIRA.map((foto, index) => (
            <FotoCard key={foto.src} foto={foto} delay={index * 50} />
          ))}
        </div>
      </div>
    </section>
  );
}
