import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiDownload, FiFileText, FiX } from 'react-icons/fi';
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

function Chip({ etiqueta, alQuitar }: { etiqueta: string; alQuitar: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-marino-50 py-1 pl-3 pr-1.5 text-sm text-marino-900">
      {etiqueta}
      <button type="button" className="rounded-full p-0.5 hover:bg-marino-100" onClick={alQuitar} aria-label={`Quitar filtro: ${etiqueta}`}>
        <FiX aria-hidden />
      </button>
    </span>
  );
}

export default function ReporteBodega() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const mostrar = (params.get('mostrar') ?? '') as Mostrar;
  const dias = Number.parseInt(params.get('dias') ?? '0', 10) || 0;
  const incluirEnCamino = params.get('enCamino') === '1';
  const [cliente, setCliente] = useState<Usuario | null>(null);
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

  function quitarBusqueda() {
    setCliente(null);
    cambiar('q', '');
  }

  function limpiarTodo() {
    setCliente(null);
    setParams({}, { replace: true });
  }

  const { datos, cargando, error } = useCarga(
    () => api.get<{ paquetes: ItemBodega[] }>(`/staff/bodega?${consultaBodega(q, mostrar, dias, incluirEnCamino).toString()}`).then((r) => r.paquetes),
    [q, mostrar, dias, incluirEnCamino],
  );

  const recibidos = datos?.filter((item) => !item.enCamino).length ?? 0;
  const enCamino = datos?.filter((item) => item.enCamino).length ?? 0;

  const filtros = [
    q ? { etiqueta: cliente ? `Cliente: ${cliente.nombre}` : `Búsqueda: "${q}"`, alQuitar: quitarBusqueda } : null,
    mostrar === 'SIN_DUENO' ? { etiqueta: 'Sin dueño', alQuitar: () => cambiar('mostrar', '') } : null,
    mostrar === 'SIN_AVISAR' ? { etiqueta: 'Sin avisar', alQuitar: () => cambiar('mostrar', '') } : null,
    dias > 0 ? { etiqueta: `${dias} días o más`, alQuitar: () => cambiar('dias', '') } : null,
    incluirEnCamino ? { etiqueta: 'Incluye lo que falta por llegar', alQuitar: () => cambiar('enCamino', '') } : null,
  ].filter((f): f is { etiqueta: string; alQuitar: () => void } => f !== null);

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
        {filtros.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-linea pb-4">
            {filtros.map((f) => (
              <Chip key={f.etiqueta} etiqueta={f.etiqueta} alQuitar={f.alQuitar} />
            ))}
            <button type="button" className="text-sm font-bold text-suave hover:text-marino hover:underline" onClick={limpiarTodo}>
              Limpiar todo
            </button>
          </div>
        )}

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
              {filtros.length === 0 ? ' · toda la bodega, sin filtros' : ''}.
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={incluirEnCamino} onChange={(e) => cambiar('enCamino', e.target.checked ? '1' : '')} />
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
