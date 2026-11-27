import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiDownload, FiFileText } from 'react-icons/fi';
import { Alerta, Cargando, ErrorCarga } from '../../components/ui';
import { ambitoActual, CABECERA_AMBITO } from '../../lib/ambito';
import { api, mensajeDeError } from '../../lib/api';
import type { ItemBodega } from '../../lib/tipos';
import { useCarga } from '../../lib/useCarga';

type FormatoReporte = 'csv' | 'pdf';

function consultaBodega(q: string, mostrar: string, dias: number, incluirEnCamino: boolean): URLSearchParams {
  const consulta = new URLSearchParams();
  if (q) consulta.set('q', q);
  if (mostrar === 'SIN_DUENO') consulta.set('sinDueno', '1');
  if (mostrar === 'SIN_AVISAR') consulta.set('sinAvisar', '1');
  if (dias > 0) consulta.set('minDias', String(dias));
  if (incluirEnCamino) consulta.set('incluirEnCamino', '1');
  return consulta;
}

export default function ReporteBodega() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const mostrar = params.get('mostrar') ?? '';
  const dias = Number.parseInt(params.get('dias') ?? '0', 10) || 0;
  const [incluirEnCamino, setIncluirEnCamino] = useState(false);
  const [formatoDescargando, setFormatoDescargando] = useState<FormatoReporte | null>(null);
  const [errorReporte, setErrorReporte] = useState<string | null>(null);

  const { datos, cargando, error } = useCarga(
    () => api.get<{ paquetes: ItemBodega[] }>(`/staff/bodega?${consultaBodega(q, mostrar, dias, incluirEnCamino).toString()}`).then((r) => r.paquetes),
    [q, mostrar, dias, incluirEnCamino],
  );

  const recibidos = datos?.filter((item) => !item.enCamino).length ?? 0;
  const enCamino = datos?.filter((item) => item.enCamino).length ?? 0;

  const filtrosTexto = [
    q ? `búsqueda "${q}"` : null,
    mostrar === 'SIN_DUENO' ? 'sin dueño' : null,
    mostrar === 'SIN_AVISAR' ? 'sin avisar' : null,
    dias > 0 ? `${dias} días o más en bodega` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  async function descargar(formato: FormatoReporte) {
    setFormatoDescargando(formato);
    setErrorReporte(null);
    try {
      const consulta = consultaBodega(q, mostrar, dias, incluirEnCamino);
      const respuesta = await fetch(`/api/staff/bodega/exportar.${formato}?${consulta.toString()}`, {
        credentials: 'same-origin',
        headers: { [CABECERA_AMBITO]: ambitoActual() },
      });
      if (!respuesta.ok) {
        throw new Error(respuesta.status === 401 ? 'Tu sesión venció. Vuelve a entrar y prueba de nuevo.' : 'No pudimos generar el reporte. Intenta de nuevo.');
      }
      const blob = await respuesta.blob();
      const nombre = `bodega-${new Date().toISOString().slice(0, 10)}.${formato}`;
      const direccion = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = direccion;
      enlace.download = nombre;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(direccion), 1000);
    } catch (falla) {
      setErrorReporte(falla instanceof Error ? falla.message : mensajeDeError(falla));
    } finally {
      setFormatoDescargando(null);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-8 sm:py-8">
      <Link to={{ pathname: '/panel/bodega', search: params.toString() }} className="btn btn-suave btn-chico mb-4">
        <FiArrowLeft aria-hidden /> Volver a bodega
      </Link>

      <h1 className="text-3xl">Generar reporte</h1>
      <p className="mt-1 text-suave">Elige cómo quieres bajar lo que hay en bodega.</p>

      <div className="tarjeta mt-5 space-y-4 p-5">
        {cargando && <Cargando />}
        {error && <ErrorCarga mensaje={error} />}
        {datos && (
          <p className="text-sm text-suave">
            Vas a bajar <b className="text-marino-900">{recibidos}</b> {recibidos === 1 ? 'paquete' : 'paquetes'}
            {incluirEnCamino && enCamino > 0 ? ` y ${enCamino} por llegar` : ''}
            {filtrosTexto ? ` · ${filtrosTexto}` : ' · toda la bodega, sin filtros'}.
          </p>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={incluirEnCamino} onChange={(e) => setIncluirEnCamino(e.target.checked)} />
          Incluir lo que falta por llegar (prealertado, aún sin llegar a la bodega)
        </label>

        {errorReporte && <Alerta tono="error">{errorReporte}</Alerta>}

        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className="btn btn-primario" disabled={formatoDescargando !== null} onClick={() => void descargar('pdf')}>
            <FiFileText aria-hidden /> {formatoDescargando === 'pdf' ? 'Generando PDF…' : 'Descargar PDF'}
          </button>
          <button type="button" className="btn btn-suave" disabled={formatoDescargando !== null} onClick={() => void descargar('csv')}>
            <FiDownload aria-hidden /> {formatoDescargando === 'csv' ? 'Generando CSV…' : 'Descargar CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}
