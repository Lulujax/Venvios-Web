import { Link } from 'react-router-dom';
import { BRAND } from '../../config/brand';
import { Reveal } from '../Reveal';

const PASOS = [
  {
    n: '01',
    titulo: 'Recibe tu código al registrarte',
    texto: 'Formato VEX-CUC-XXXX. Es único, personal y no cambia.',
  },
  {
    n: '02',
    titulo: 'Úsalo como referencia en tus compras',
    texto: 'Cópialo en la dirección de entrega de la tienda colombiana o escríbelo en el paquete.',
  },
  {
    n: '03',
    titulo: 'Regístralo en la prealerta',
    texto: 'Desde tu panel avisas qué viene en camino y la sede lo identifica al recibirlo.',
  },
];

export function CasilleroInfo() {
  return (
    <section id="casillero" className="scroll-mt-24 border-b border-line">
      <div className="shell py-20 lg:py-28">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-6">
            <p className="eyebrow">§ 04 / Casillero</p>
            <Reveal>
              <h2 className="display-lg mt-4 max-w-[16ch] text-balance">
                Tu dirección en Cúcuta tiene nombre: casillero.
              </h2>
              <p className="mt-5 max-w-[50ch] text-sm leading-relaxed text-muted sm:text-base">
                Cuando compras en Colombia, no necesitas una dirección física distinta para cada
                tienda. Con tu código de casillero, todo llega a un solo lugar: nuestra sede en
                Barrio Latino, Centro de Cúcuta.
              </p>
            </Reveal>

            <ol className="mt-9 border-t border-ink/20">
              {PASOS.map((paso) => (
                <li key={paso.n} className="border-b border-ink/15">
                  <div className="grid gap-3 py-5 sm:grid-cols-12 sm:gap-5">
                    <span className="font-mono text-[11px] text-gold sm:col-span-1">{paso.n}</span>
                    <p className="text-sm font-medium text-ink sm:col-span-5">{paso.titulo}</p>
                    <p className="text-sm leading-relaxed text-muted sm:col-span-6">{paso.texto}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-8 grid gap-6 border-t border-ink/20 pt-5 sm:grid-cols-2">
              <div>
                <p className="meta">Dirección de recepción</p>
                <p className="mt-2 text-sm leading-relaxed text-ink">
                  {BRAND.address.line1}
                  <br />
                  {BRAND.address.line2}
                </p>
              </div>
              <div>
                <p className="meta">Horario de sede</p>
                <p className="mt-2 text-sm leading-relaxed text-ink">{BRAND.hours}</p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                  Recepción de paquetes
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 lg:col-start-8">
            <Reveal delay={120}>
              <div className="relative">
                <div
                  className="absolute -left-4 -top-4 h-full w-full border border-navy/20 bg-gold/25"
                  aria-hidden="true"
                />

                <div className="relative border border-navy bg-white">
                  <div className="flex items-center justify-between gap-3 bg-navy px-5 py-3.5 text-paper">
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper/70">
                      Asignación de casillero
                    </p>
                    <span className="border border-gold/60 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em] text-gold">
                      Ejemplo
                    </span>
                  </div>

                  <div className="px-5 pb-5 pt-6">
                    <p className="meta">Tu código único</p>
                    <p className="mt-2 font-mono text-[clamp(1.7rem,4.2vw,2.5rem)] leading-none tracking-tight text-navy">
                      VEX-CUC-4827
                    </p>

                    <div className="barcode mt-5 text-navy" aria-hidden="true" />
                    <div className="mt-2 flex items-center justify-between font-mono text-[8px] tracking-[0.16em] text-muted">
                      <span>VEX · CÚCUTA</span>
                      <span>4827</span>
                    </div>

                    <div className="mt-5 border-t border-dashed border-ink/25 pt-4">
                      <p className="meta">Dirección de recepción</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink">
                        Venvios Express
                        <br />
                        Barrio Latino, Centro
                        <br />
                        Cúcuta, Norte de Santander · Colombia
                      </p>
                      <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                        Referencia obligatoria: VEX-CUC-4827
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-line bg-paper px-5 py-3">
                    <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-muted">
                      Uso personal e intransferible
                    </p>
                    <p className="font-display text-[12px] font-bold text-navy">Tu mejor opción</p>
                  </div>
                </div>
              </div>

              <p className="mt-6 max-w-[38ch] font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-muted">
                Ejemplo ilustrativo. Tu código se genera automáticamente al crear la cuenta y queda
                visible en tu panel.
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
