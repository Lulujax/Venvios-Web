import { Fragment, useMemo, useState } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { useConfirmar } from '../../components/Confirmar';
import { PagosPersonal } from '../../components/envio/PagosPersonal';
import { Alerta, Cargando, ErrorCarga, Vacio, useAviso } from '../../components/ui';
import { api, mensajeDeError } from '../../lib/api';
import { formatearBs, formatearFecha, formatearUsd, NOMBRE_METODO } from '../../lib/formato';
import type { Envio, FilaPago } from '../../lib/tipos';
import { useEsEscritorio } from '../../lib/pantalla';
import { useCarga } from '../../lib/useCarga';

const TAMANO_LOTE = 100;
const METODOS = ['TODOS', 'BINANCE', 'PAGO_MOVIL', 'TRANSFERENCIA', 'MANUAL'] as const;
type Orden = 'ANTIGUO' | 'RECIENTE' | 'MONTO';

interface ResultadoLote {
  confirmados: string[];
  fallidos: Array<{ id: string; motivo: string }>;
  enviosPagados: number;
}

function coincide(fila: FilaPago, busqueda: string): boolean {
  if (!busqueda) return true;
  const texto = `${fila.cliente} ${fila.numero} ${fila.referencia ?? ''}`.toLowerCase();
  return busqueda.toLowerCase().split(/\s+/).every((palabra) => texto.includes(palabra));
}

function ordenar(filas: FilaPago[], orden: Orden): FilaPago[] {
  const copia = [...filas];
  if (orden === 'RECIENTE') return copia.sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  if (orden === 'MONTO') return copia.sort((a, b) => b.montoUsdCentavos - a.montoUsdCentavos);
  return copia.sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
}

function DetalleFila({ envioId, alCambiar }: { envioId: string; alCambiar: () => void }) {
  const { datos, cargando, error, recargar } = useCarga(() => api.get<{ envio: Envio }>(`/envios/${envioId}`).then((r) => r.envio), [envioId]);
  if (cargando) return <Cargando />;
  if (error || !datos) return <ErrorCarga mensaje={error ?? 'No encontramos ese envío.'} reintentar={() => void recargar()} />;
  return <PagosPersonal envio={datos} alCambiar={() => alCambiar()} />;
}

export default function PagosPendientes() {
  const avisar = useAviso();
  const pedirConfirmacion = useConfirmar();
  const escritorio = useEsEscritorio();
  const { datos, setDatos, cargando, error, recargar } = useCarga(() => api.get<{ pagos: FilaPago[] }>('/staff/pagos/pendientes').then((r) => r.pagos));
  const [busqueda, setBusqueda] = useState('');
  const [metodo, setMetodo] = useState<(typeof METODOS)[number]>('TODOS');
  const [orden, setOrden] = useState<Orden>('RECIENTE');
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [abierto, setAbierto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorLote, setErrorLote] = useState<string | null>(null);
  const [resumen, setResumen] = useState<string | null>(null);

  const visibles = useMemo(
    () => ordenar((datos ?? []).filter((fila) => (metodo === 'TODOS' || fila.metodo === metodo) && coincide(fila, busqueda)), orden),
    [datos, metodo, busqueda, orden],
  );
  const totalVisiblesCentavos = visibles.reduce((suma, fila) => suma + fila.montoUsdCentavos, 0);
  const seleccionadas = ordenar((datos ?? []).filter((fila) => seleccion.has(fila.pagoId)), 'RECIENTE');
  const totalSeleccionCentavos = seleccionadas.reduce((suma, fila) => suma + fila.montoUsdCentavos, 0);
  const todosVisiblesMarcados = visibles.length > 0 && visibles.every((fila) => seleccion.has(fila.pagoId));

  function alternar(pagoId: string) {
    setSeleccion((actual) => {
      const nueva = new Set(actual);
      if (nueva.has(pagoId)) nueva.delete(pagoId);
      else nueva.add(pagoId);
      return nueva;
    });
  }

  function alternarTodosVisibles() {
    setSeleccion((actual) => {
      const nueva = new Set(actual);
      for (const fila of visibles) {
        if (todosVisiblesMarcados) nueva.delete(fila.pagoId);
        else nueva.add(fila.pagoId);
      }
      return nueva;
    });
  }

  async function confirmarSeleccion() {
    const ids = seleccionadas.map((fila) => fila.pagoId);
    if (ids.length === 0) return;
    const aceptado = await pedirConfirmacion({
      titulo: `¿Confirmar ${ids.length} ${ids.length === 1 ? 'pago' : 'pagos'}?`,
      pregunta: `Suman ${formatearUsd(totalSeleccionCentavos)}. Revisa los comprobantes antes de confirmar: no se puede deshacer desde esta pantalla.`,
      accion: `Sí, confirmar ${ids.length}`,
    });
    if (!aceptado) return;

    setEnviando(true);
    setErrorLote(null);
    setResumen(null);
    const confirmados: string[] = [];
    const fallidos: Array<{ id: string; motivo: string }> = [];
    let enviosPagados = 0;
    try {
      for (let inicio = 0; inicio < ids.length; inicio += TAMANO_LOTE) {
        const trozo = ids.slice(inicio, inicio + TAMANO_LOTE);
        const r = await api.post<ResultadoLote>('/staff/pagos/confirmar-lote', { ids: trozo });
        confirmados.push(...r.confirmados);
        fallidos.push(...r.fallidos);
        enviosPagados += r.enviosPagados;
      }
      const textoFallidos = fallidos.length > 0 ? ` ${fallidos.length} no se confirmaron: ${fallidos.map((f) => f.motivo).filter((m, i, lista) => lista.indexOf(m) === i).join('; ')}.` : '';
      setResumen(`${confirmados.length} ${confirmados.length === 1 ? 'pago confirmado' : 'pagos confirmados'}. ${enviosPagados} ${enviosPagados === 1 ? 'envío quedó pagado' : 'envíos quedaron pagados'}.${textoFallidos}`);
      avisar('Revisión en lote terminada.');
    } catch (falla) {
      setErrorLote(mensajeDeError(falla));
    } finally {
      setEnviando(false);
      setSeleccion(new Set());
      await recargar();
    }
  }

  function quitarRevisado(pagoId: string) {
    setDatos((actuales) => (actuales ?? []).filter((fila) => fila.pagoId !== pagoId));
    setSeleccion((actual) => {
      const nueva = new Set(actual);
      nueva.delete(pagoId);
      return nueva;
    });
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="mb-1 text-3xl">Pagos por revisar</h1>
      <p className="mb-5 text-suave">Todos los pagos pendientes en una sola lista. Marca varios y confírmalos juntos, o abre uno para ver su comprobante.</p>

      {cargando && <Cargando />}
      {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
      {datos && datos.length === 0 && <Vacio titulo="Todo al día" texto="No hay comprobantes esperando revisión." />}

      {datos && datos.length > 0 && (
        <>
          <div className="mb-4 grid grid-cols-2 items-end gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_16rem]">
            <div className="col-span-2 lg:col-span-1">
              <label htmlFor="buscar-pagos" className="etiqueta">Buscar</label>
              <input id="buscar-pagos" type="search" className="campo" placeholder="Cliente, consolidación o referencia" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
            <div>
              <label htmlFor="filtro-metodo" className="etiqueta">Método</label>
              <select id="filtro-metodo" className="campo" value={metodo} onChange={(e) => setMetodo(e.target.value as (typeof METODOS)[number])}>
                {METODOS.map((m) => <option key={m} value={m}>{m === 'TODOS' ? 'Todos' : NOMBRE_METODO[m] ?? m}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="orden-pagos" className="etiqueta">Ordenar</label>
              <select id="orden-pagos" className="campo" value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
                <option value="RECIENTE">Más recientes</option>
                <option value="ANTIGUO">Más antiguos</option>
                <option value="MONTO">Mayor monto</option>
              </select>
            </div>
          </div>

          <div className="sticky top-14 z-20 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-linea bg-white px-4 py-3 shadow-elevada lg:top-16">
            <p className="text-sm">
              <span className="font-bold">{visibles.length}</span> {visibles.length === 1 ? 'pago' : 'pagos'} · {formatearUsd(totalVisiblesCentavos)}
              {seleccion.size > 0 && <span className="ml-3 font-bold text-marino">{seleccion.size} seleccionados · {formatearUsd(totalSeleccionCentavos)}</span>}
            </p>
            <button type="button" className="btn btn-primario btn-chico" disabled={seleccion.size === 0 || enviando} onClick={() => void confirmarSeleccion()}>
              {enviando ? 'Confirmando…' : seleccion.size > 0 ? `Confirmar ${seleccion.size} seleccionados` : 'Confirmar seleccionados'}
            </button>
          </div>

          {resumen && <Alerta tono="ok">{resumen}</Alerta>}
          {errorLote && <Alerta tono="error">{errorLote}</Alerta>}

          {escritorio ? (
          <div className="overflow-x-auto rounded-2xl border border-linea bg-white">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="sticky top-0 bg-papel text-xs uppercase tracking-wide text-suave">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" aria-label="Seleccionar todos los pagos visibles" checked={todosVisiblesMarcados} onChange={alternarTodosVisibles} className="h-5 w-5" />
                  </th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3 text-right">Monto</th>
                  <th className="px-3 py-3">Método</th>
                  <th className="px-3 py-3">Referencia</th>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Comprobante</th>
                  <th className="px-3 py-3"><span className="sr-only">Abrir</span></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((fila) => {
                  const estaAbierto = abierto === fila.pagoId;
                  return (
                    <Fragment key={fila.pagoId}>
                      <tr className={`border-t border-linea ${seleccion.has(fila.pagoId) ? 'bg-marino-50' : ''}`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" aria-label={`Seleccionar pago de ${fila.cliente}`} checked={seleccion.has(fila.pagoId)} onChange={() => alternar(fila.pagoId)} className="h-5 w-5" />
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-bold">{fila.cliente}</p>
                          <p className="text-xs text-suave">Consolidación {fila.numero}</p>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <p className="font-bold">{formatearUsd(fila.montoUsdCentavos)}</p>
                          {fila.moneda === 'BS' && <p className="text-xs text-suave">{formatearBs(fila.montoOriginalCentavos)}</p>}
                        </td>
                        <td className="px-3 py-2">{NOMBRE_METODO[fila.metodo] ?? fila.metodo}</td>
                        <td className="px-3 py-2 font-mono text-xs">{fila.referencia ?? '—'}</td>
                        <td className="px-3 py-2 text-suave">{formatearFecha(fila.creadoEn)}</td>
                        <td className="px-3 py-2">{fila.tieneComprobante ? 'Sí' : 'No'}</td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" className="btn btn-suave btn-chico" aria-expanded={estaAbierto} onClick={() => setAbierto(estaAbierto ? null : fila.pagoId)}>
                            {estaAbierto ? <FiChevronUp aria-hidden /> : <FiChevronDown aria-hidden />} {estaAbierto ? 'Cerrar' : 'Revisar'}
                          </button>
                        </td>
                      </tr>
                      {estaAbierto && (
                        <tr className="border-t border-linea bg-papel">
                          <td colSpan={8} className="px-4 py-4">
                            <DetalleFila envioId={fila.envioId} alCambiar={() => { quitarRevisado(fila.pagoId); void recargar(); }} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          ) : (
          <>
            <label className="mb-2 flex items-center gap-2 text-sm text-suave">
              <input type="checkbox" className="h-5 w-5" checked={todosVisiblesMarcados} onChange={alternarTodosVisibles} />
              Seleccionar todos los pagos visibles
            </label>
            <ul className="space-y-3">
              {visibles.map((fila) => {
                const estaAbierto = abierto === fila.pagoId;
                return (
                  <li key={fila.pagoId} className={`tarjeta p-3 ${seleccion.has(fila.pagoId) ? 'border-marino ring-2 ring-marino/20' : ''}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" aria-label={`Seleccionar pago de ${fila.cliente}`} checked={seleccion.has(fila.pagoId)} onChange={() => alternar(fila.pagoId)} className="mt-1 h-6 w-6 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{fila.cliente}</p>
                        <p className="text-xs text-suave">Consolidación {fila.numero} · {formatearFecha(fila.creadoEn)}</p>
                        <p className="mt-1 text-sm"><b>{formatearUsd(fila.montoUsdCentavos)}</b>{fila.moneda === 'BS' ? ` (${formatearBs(fila.montoOriginalCentavos)})` : ''} · {NOMBRE_METODO[fila.metodo] ?? fila.metodo}</p>
                        <p className="codigo truncate text-xs text-suave">Ref. {fila.referencia ?? '—'} · {fila.tieneComprobante ? 'Con comprobante' : 'Sin comprobante'}</p>
                      </div>
                    </div>
                    <button type="button" className="btn btn-suave btn-chico ml-9 mt-3" aria-expanded={estaAbierto} onClick={() => setAbierto(estaAbierto ? null : fila.pagoId)}>
                      {estaAbierto ? <FiChevronUp aria-hidden /> : <FiChevronDown aria-hidden />} {estaAbierto ? 'Cerrar' : 'Revisar'}
                    </button>
                    {estaAbierto && <div className="mt-3"><DetalleFila envioId={fila.envioId} alCambiar={() => { quitarRevisado(fila.pagoId); void recargar(); }} /></div>}
                  </li>
                );
              })}
            </ul>
          </>
          )}
          {visibles.length === 0 && <p className="mt-4 text-sm text-suave">Ningún pago coincide con la búsqueda o el filtro.</p>}
        </>
      )}
    </div>
  );
}
