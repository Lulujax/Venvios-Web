import { Link } from 'react-router-dom';
import { FaFacebookF, FaInstagram, FaTiktok, FaWhatsapp } from 'react-icons/fa';
import { FiBox, FiCheckCircle, FiMapPin, FiPackage, FiSend, FiTruck } from 'react-icons/fi';
import { Calculadora } from '../components/Calculadora';
import { Rastreador } from '../components/Rastreador';
import { Cargando, ErrorCarga, Marca } from '../components/ui';
import { api } from '../lib/api';
import { useAuth, rutaInicial } from '../lib/auth';
import { formatearBs, formatearUsd } from '../lib/formato';
import type { InfoPublica } from '../lib/tipos';
import { useCarga } from '../lib/useCarga';

const PASOS = [
  { icono: FiBox, titulo: 'Compra donde quieras', texto: 'Shein, AliExpress, Amazon o cualquier tienda. Envía a nuestra oficina en Cúcuta.' },
  { icono: FiPackage, titulo: 'Avísanos tu compra', texto: 'Registra tu tracking en tu cuenta. Cuando tu paquete llegue a nuestra oficina, te escribimos por WhatsApp.' },
  { icono: FiCheckCircle, titulo: 'Realiza tu pago en Bs', texto: 'Consulta tu total en tu cuenta y págalo en bolívares a tasa BCV.' },
  { icono: FiTruck, titulo: 'Sale a Venezuela', texto: 'Lo despachamos con MRW o Zoom. Te enviamos la guía con foto para que lo rastrees.' },
];

function nombreTramo(desde: number, siguiente: number | undefined): string {
  if (siguiente === undefined) return `${desde} kg en adelante`;
  return `${desde} a ${(siguiente - 0.01).toFixed(2).replace('.', ',')} kg`;
}

export default function Landing() {
  const { usuario } = useAuth();
  const { datos, cargando, error, recargar } = useCarga(() => api.get<InfoPublica>('/publico/info'));
  const whatsapp = datos ? `https://wa.me/${datos.contacto.whatsapp}?text=${encodeURIComponent('Hola Venvios Express, quiero información sobre el casillero.')}` : '#';

  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-linea/70 bg-papel/90 backdrop-blur">
        <div className="contenedor flex h-16 items-center justify-between">
          <Link to="/" aria-label="Venvios Express, inicio"><Marca /></Link>
          <nav className="hidden items-center gap-7 text-sm font-bold text-marino md:flex" aria-label="Secciones">
            <a href="#tarifas" className="hover:underline underline-offset-4">Tarifas</a>
            <a href="#calculadora" className="hover:underline underline-offset-4">Calcular</a>
            <a href="#rastreo" className="hover:underline underline-offset-4">Rastrear</a>
            <a href="#contacto" className="hover:underline underline-offset-4">Contacto</a>
          </nav>
          <div className="flex items-center gap-2">
            {usuario ? (
              <Link to={rutaInicial(usuario)} className="btn btn-primario btn-chico">Mi cuenta</Link>
            ) : (
              <>
                <Link to="/ingresar" className="btn btn-suave btn-chico">Ingresar</Link>
                <Link to="/registro" className="btn btn-primario btn-chico hidden sm:inline-flex">Crear cuenta</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-marino-900 text-white">
        <div className="cinta-diagonal absolute inset-0" aria-hidden />
        <div className="contenedor relative grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:py-20">
          <div className="animate-entrar">
            <p className="insignia mb-5 bg-oro text-marino-900">Casillero internacional · Cúcuta → Venezuela</p>
            <h1 className="text-[2.4rem] leading-[1.05] text-white sm:text-6xl">
              Más cerca de <span className="text-oro">quienes más quieres.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/80">
              Compras en Shein, AliExpress o Amazon, llegan a nuestra oficina en Cúcuta y las llevamos hasta tu casa en Venezuela. Pagas en bolívares a tasa BCV.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/registro" className="btn btn-acento">Crear mi casillero</Link>
              <a href="#calculadora" className="btn border border-white/30 text-white hover:bg-white/10">¿Cuánto me costaría?</a>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 text-sm">
              <div><dt className="text-white/60">Desde</dt><dd className="font-display text-2xl font-bold text-oro">{datos ? formatearUsd(datos.tarifas.m2PrecioPorKgCentavos) : '6 $'}<span className="text-sm font-sans text-white/60">/kg</span></dd></div>
              <div><dt className="text-white/60">Tasa BCV</dt><dd className="font-display text-2xl font-bold">{datos?.tasa ? datos.tasa.bolivaresPorUsd.toFixed(2) : '—'}</dd></div>
              <div><dt className="text-white/60">Transporte</dt><dd className="font-display text-2xl font-bold">MRW · Zoom</dd></div>
            </dl>
          </div>

          <div id="rastreo" className="tarjeta animate-entrar p-5 text-tinta sm:p-6">
            <h2 className="mb-1 text-2xl">Rastrea tu envío</h2>
            <p className="mb-4 text-sm text-suave">Elige la transportista y te llevamos a su sistema oficial.</p>
            {cargando && <Cargando lineas={2} />}
            {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
            {datos && <Rastreador transportistas={datos.transportistas} />}
          </div>
        </div>
      </section>

      <section id="tarifas" className="contenedor scroll-mt-20 py-16">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-rojo">Tarifas</p>
          <h2 className="mt-2 text-3xl sm:text-4xl">Dos formas de pagar, cero letra pequeña</h2>
          <p className="mt-3 text-suave">Precios en dólares. Si prefieres pagar en bolívares, usamos la tasa BCV del día. El peso es el físico y se cobra exacto, sumando todos los paquetes de tu envío.</p>
        </div>
        {cargando && <Cargando />}
        {datos && (
          <div className="grid gap-5 lg:grid-cols-2">
            <article className="tarjeta overflow-hidden">
              <header className="bg-marino px-6 py-4 text-white"><h3 className="text-xl text-white">Todo incluido</h3><p className="text-sm text-white/70">Pagas todo a Venvios. Mínimo {datos.tarifas.m1PesoMinimoKg} kg.</p></header>
              <ul className="divide-y divide-linea px-6">
                {datos.tarifas.m1Tramos.map((tramo, indice) => (
                  <li key={tramo.desdeKg} className="flex items-center justify-between py-4">
                    <span className="font-semibold">{nombreTramo(tramo.desdeKg, datos.tarifas.m1Tramos[indice + 1]?.desdeKg)}</span>
                    <span className="font-display text-2xl font-bold text-marino-900">{formatearUsd(tramo.precioPorKgCentavos)}<span className="text-sm font-sans text-suave"> /kg</span></span>
                  </li>
                ))}
              </ul>
              <p className="border-t border-linea bg-marino-50 px-6 py-3 text-sm text-marino-900">+ {datos.tarifas.m1SeguroPorcentaje}% del valor declarado como seguro de carga.</p>
            </article>
            <article className="tarjeta overflow-hidden">
              <header className="bg-oro px-6 py-4 text-marino-900"><h3 className="text-xl">Cobro a destino</h3><p className="text-sm text-marino-900/70">Mínimo {datos.tarifas.m2PesoMinimoKg} kg. Ideal para paquetes pequeños.</p></header>
              <div className="px-6 py-6">
                <p className="font-display text-5xl font-bold text-marino-900">{formatearUsd(datos.tarifas.m2PrecioPorKgCentavos)}<span className="text-lg font-sans text-suave"> /kg</span></p>
                <p className="mt-2 font-semibold">+ {datos.tarifas.m2SeguroPorcentaje}% del valor declarado como seguro de carga.</p>
                <p className="mt-4 text-sm text-suave">Nosotros no financiamos el tramo en Venezuela: tú pagas a MRW o Zoom directamente cuando recibes tu paquete.</p>
              </div>
            </article>
          </div>
        )}
        <p className="mt-5 rounded-2xl bg-oro-50 px-4 py-3 text-sm font-semibold text-marino-900">Nota: pagos en Bs a tasa BCV{datos?.tasa ? ` (hoy ${formatearBs(Math.round(datos.tasa.bolivaresPorUsd * 100))} por dólar)` : ''}.</p>
      </section>

      <section id="calculadora" className="scroll-mt-20 border-y border-linea bg-white py-16">
        <div className="contenedor">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-rojo">Calculadora</p>
            <h2 className="mt-2 text-3xl sm:text-4xl">Calcula antes de comprar</h2>
          </div>
          <Calculadora />
        </div>
      </section>

      <section className="contenedor py-16">
        <h2 className="mb-10 text-3xl sm:text-4xl">Así funciona</h2>
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PASOS.map((paso, indice) => (
            <li key={paso.titulo} className="tarjeta relative p-5">
              <span className="absolute right-4 top-3 font-display text-5xl font-extrabold text-oro/60" aria-hidden>{indice + 1}</span>
              <paso.icono className="mb-4 text-3xl text-marino" aria-hidden />
              <h3 className="text-lg">{paso.titulo}</h3>
              <p className="mt-2 text-sm text-suave">{paso.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="contacto" className="scroll-mt-20 bg-marino-900 py-16 text-white">
        <div className="contenedor grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl text-white sm:text-4xl">Escríbenos, respondemos personas</h2>
            <p className="mt-3 max-w-md text-white/70">Pregunta por tu paquete, tu pago o cómo empezar. Atendemos por WhatsApp.</p>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn mt-6 bg-[#25D366] text-marino-900"><FaWhatsapp aria-hidden className="text-xl" /> Escribir por WhatsApp</a>
          </div>
          <div className="space-y-4 rounded-tarjeta border border-white/15 p-6">
            <p className="flex items-start gap-3"><FiMapPin className="mt-1 shrink-0 text-oro" aria-hidden /><span>{datos?.contacto.direccion ?? 'Barrio Latino, Cúcuta'}</span></p>
            <p className="flex items-center gap-3"><FiSend className="shrink-0 text-oro" aria-hidden /> @venviosexpress</p>
            {datos && (
              <div className="flex gap-3 pt-2">
                <a aria-label="Instagram" href={datos.contacto.instagram} target="_blank" rel="noopener noreferrer" className="grid h-11 w-11 place-items-center rounded-full border border-white/25 hover:bg-white/10"><FaInstagram aria-hidden /></a>
                <a aria-label="Facebook" href={datos.contacto.facebook} target="_blank" rel="noopener noreferrer" className="grid h-11 w-11 place-items-center rounded-full border border-white/25 hover:bg-white/10"><FaFacebookF aria-hidden /></a>
                <a aria-label="TikTok" href={datos.contacto.tiktok} target="_blank" rel="noopener noreferrer" className="grid h-11 w-11 place-items-center rounded-full border border-white/25 hover:bg-white/10"><FaTiktok aria-hidden /></a>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="bg-marino-900 pb-8 text-center text-sm text-white/50">
        <p>© {new Date().getFullYear()} Venvios Express · Tu mejor opción</p>
        <p className="mt-1"><Link to="/ingresar" className="underline underline-offset-4">Acceso del personal</Link></p>
      </footer>
    </div>
  );
}
