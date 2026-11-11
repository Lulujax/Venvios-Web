import { Link } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { Reveal } from '../Reveal';

const PASOS = [
  {
    n: '01',
    titulo: 'Regístrate',
    descripcion:
      'Crea tu cuenta y recibe un código de casillero único. Esa es la dirección a la que llegan tus compras en Cúcuta.',
    meta: '2 min · Digital',
  },
  {
    n: '02',
    titulo: 'Compra y prealerta',
    descripcion:
      'Compra en tiendas colombianas o despacha tu paquete. Registra la prealerta con la tienda y el número de guía para que la sede lo espere.',
    meta: 'Desde casa',
  },
  {
    n: '03',
    titulo: 'Recibimos en Cúcuta',
    descripcion:
      'Tu paquete llega a Barrio Latino. Lo pesamos, lo fotografiamos y calculamos el costo. Te avisamos por WhatsApp el mismo día.',
    meta: 'Sede Cúcuta',
  },
  {
    n: '04',
    titulo: 'Enviamos a Venezuela',
    descripcion:
      'Confirmas el pago y despachamos puerta a puerta. Cada cambio de estado se te notifica por WhatsApp, sin llamadas ni filas.',
    meta: 'Puerta a puerta',
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-24 border-b border-line">
      <div className="shell py-20 lg:py-28">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <p className="eyebrow">§ 02 / Operación</p>
            <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
              Cúcuta · CO
            </p>
          </div>

          <div className="lg:col-span-7">
            <Reveal>
              <h2 className="display-lg max-w-[18ch] text-balance">
                Cuatro pasos. Cero adivinanzas.
              </h2>
              <p className="mt-5 max-w-[56ch] text-sm leading-relaxed text-muted sm:text-base">
                El recorrido completo de tu paquete, desde la tienda colombiana hasta la puerta del
                destinatario en Venezuela. Todo queda registrado en tu cuenta.
              </p>
            </Reveal>
          </div>

          <div className="hidden text-right lg:col-span-2 lg:block">
            <p className="font-mono text-[52px] leading-none tracking-tight text-line">04</p>
            <p className="meta mt-2">pasos</p>
          </div>
        </div>

        <ol className="mt-14 border-t border-ink/20">
          {PASOS.map((paso, index) => (
            <li key={paso.n} className="border-b border-ink/15">
              <Reveal delay={index * 40}>
                <div className="grid gap-4 py-8 lg:grid-cols-12 lg:gap-6 lg:py-10">
                  <div className="flex items-center gap-4 lg:col-span-2 lg:block">
                    <span className="font-mono text-[38px] leading-none tracking-tight text-gold lg:text-[44px]">
                      {paso.n}
                    </span>
                    <span
                      className="h-px flex-1 bg-gold/40 lg:mt-4 lg:block lg:h-px lg:w-10 lg:flex-none"
                      aria-hidden="true"
                    />
                  </div>

                  <h3 className="display-md lg:col-span-4">{paso.titulo}</h3>

                  <p className="max-w-[46ch] text-sm leading-relaxed text-muted lg:col-span-4">
                    {paso.descripcion}
                  </p>

                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45 lg:col-span-2 lg:text-right">
                    {paso.meta}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
            Estado del paquete visible 24/7 en tu panel
          </p>
          <Link
            to="/login?modo=registro"
            className="link-underline inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-navy"
          >
            Empezar por el paso 01
            <Icon name="arrowRight" size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
