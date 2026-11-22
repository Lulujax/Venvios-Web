import { Link } from 'react-router-dom';
import { LayoutPublico } from '../../components/LayoutPublico';
import { Marca } from '../../components/ui';
import type { DocumentoLegal } from './contenido';

function fechaLarga(iso: string): string {
  const fecha = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function PaginaLegal({ documento }: { documento: DocumentoLegal }) {
  return (
    <LayoutPublico>
      <header className="border-b border-linea bg-papel/90">
        <div className="contenedor flex h-16 items-center justify-between gap-3">
          <Link to="/" aria-label="Venvios Express, inicio">
            <Marca />
          </Link>
          <Link to="/" className="btn btn-suave btn-chico">Volver al inicio</Link>
        </div>
      </header>

      <main className="contenedor py-10 sm:py-14">
        <article className="mx-auto max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-rojo">Legal</p>
          <h1 className="mt-2 text-3xl sm:text-4xl">{documento.titulo}</h1>
          <p className="mt-2 text-sm text-suave">Última actualización: {fechaLarga(documento.actualizado)}</p>

          <div className="mt-10 space-y-8">
            {documento.secciones.map((seccion) => (
              <section key={seccion.titulo}>
                <h2 className="text-xl">{seccion.titulo}</h2>
                {seccion.parrafos?.map((parrafo) => (
                  <p key={parrafo} className="mt-3 text-[15px] leading-relaxed text-suave">{parrafo}</p>
                ))}
                {seccion.lista && (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-suave">
                    {seccion.lista.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </article>
      </main>
    </LayoutPublico>
  );
}