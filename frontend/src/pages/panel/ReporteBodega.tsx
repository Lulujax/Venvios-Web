import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiDownload, FiFileText } from 'react-icons/fi';
import { BuscadorCliente } from '../../components/BuscadorCliente';
import { Alerta, Cargando, ErrorCarga } from '../../components/ui';
import { ambitoActual, CABECERA_AMBITO } from '../../lib/ambito';
import { api, mensajeDeError } from '../../lib/api';
import type { ItemBodega, Usuario } from '../../lib/tipos';
import { useCarga } from '../../lib/useCarga';

type FormatoReporte = 'csv' | 'pdf';
type Mostrar = '' | 'SIN_DUENO' | 'SIN_AVISAR';

function consultaBodega(q: string, mostrar: Mostrar, dias: number, incluirEnCamino: boolean): URLSearchParams {
  const consulta = new URLSearchParams();
  if (q) consulta.set('q', q);
  if (mostrar === 'SIN_DUENO') consulta.set('sinDueno', '1');
  if (mostrar === 'SIN_AVISAR') consulta.set('sinAvisar', '1');
  if (dias > 0) consulta.set('minDias', String(dias));
  if (incluirEnCamino) consulta.set('incluirEnCamino', '1');
  return consulta;
}

export default function ReporteBodega() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const mostrar = (params.get('mostrar') ?? '') as Mostrar;
  const dias = Number.parseInt(params.get('dias') ?? '0', 10) || 0;
  const [cliente, setCliente] = useState<Usuario | null>(null);
  const [incluirEnCamino, setIncluirEnCamino] = useState(false);
  const [formatoDescargando, setFormatoDescargando] = useState<FormatoReporte | null>(null);
  const [errorReporte, setErrorReporte] = useState<string | null>(null);

  const cambiar = (clave: string, valor: string) => {
    const nuevos = new URLSearchParams(params);
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    setParams(nuevos, { replace: true });
  };

  function elegirCliente(elegido: Usuario | null) {
    setCliente(elegido);
    cambiar('q', elegido ? elegido.codigo : '');
  }

  const { datos, cargando, error } = useCarga(
    () => api.get<{ paquetes: ItemBodega[] }>(`/staff/bodega?${consultaBodega(q, mostrar, dias, incluirEnCamino).toString()}`).then((r) => r.paquetes),
    [q, mostrar, dias, incluirEnCamino],
  );

  const recibidos = datos?.filter((item) => !item.enCamino).length ?? 0;
  const enCamino = datos?.filter((item) => item.enCamino).length ?? 0;

  const filtrosTexto = [
    cliente ? `cliente ${cliente.nombre}` : q ? `búsqueda "${q}"` : null,
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
      <p className="mt-1 text-suave">Elige qué paquetes quieres y cómo bajarlos.</p>

      <div className="tarjeta mt-5 space-y-4 p-5">
        <div>
          <p className="etiqueta">Cliente (déjalo vacío para toda la bodega)</p>
          <BuscadorCliente cliente={cliente} onElegir={elegirCliente} etiqueta="Buscar un cliente" />
          {cliente && (
            <Link to={`/panel/envios?estado=TODOS&q=${encodeURIComponent(cliente.codigo)}`} className="mt-2 inline-block text-sm font-bold text-marino hover:underline">
              Ver su historial completo en Envíos (incluye lo ya despachado y entregado)
            </Link>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="mostrar-reporte" className="etiqueta">Mostrar</label>
            <select id="mostrar-reporte" className="campo" value={mostrar} onChange={(e) => cambiar('mostrar', e.target.value)}>
              <option value="">Todos</option>
              <option value="SIN_DUENO">Sin dueño</option>
              <option value="SIN_AVISAR">Sin avisar</option>
            </select>
          </div>
          <div>
            <label htmlFor="dias-reporte" className="etiqueta">Días en bodega</label>
            <select id="dias-reporte" className="campo" value={dias} onChange={(e) => cambiar('dias', e.target.value === '0' ? '' : e.target.value)}>
              <option value={0}>Cualquiera</option>
              <option value={7}>7 o más</option>
              <option value={15}>15 o más</option>
              <option value={30}>30 o más</option>
            </select>
          </div>
        </div>

        <div className="border-t border-linea pt-4">
          {cargando && <Cargando />}
          {error && <ErrorCarga mensaje={error} />}
          {datos && (
            <p className="text-sm text-suave">
              Vas a bajar <b className="text-marino-900">{recibidos}</b> {recibidos === 1 ? 'paquete' : 'paquetes'}
              {incluirEnCamino && enCamino > 0 ? ` y ${enCamino} por llegar` : ''}
              {filtrosTexto ? ` · ${filtrosTexto}` : ' · toda la bodega, sin filtros'}.
            </p>
          )}
        </div>

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
