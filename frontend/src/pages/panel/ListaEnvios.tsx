import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiDownload, FiPlus } from 'react-icons/fi';
import { useConfirmar } from '../../components/Confirmar';
import { Alerta, Campo, Cargando, ErrorCarga, InsigniaEstado, Vacio, useAviso } from '../../components/ui';
import { api, mensajeDeError } from '../../lib/api';
import { diasEnBodega, ETIQUETAS_ESTADO, formatearFecha, formatearUsd, nombreEnvio, nombreTransportista } from '../../lib/formato';
import { resumenDeLote, sumarResultados, trozosDe, type ResultadoLote } from '../../lib/lotes';
import type { Envio, EstadoEnvio, PaginaEnvios } from '../../lib/tipos';
import { useEsEscritorio } from '../../lib/pantalla';
import { useCarga } from '../../lib/useCarga';

const LIMITE_LOTE_DESPACHO = 50;
const ESPERA_BUSQUEDA_MS = 300;

function DespachoEnLote({ envios, alTerminar, alCancelar }: { envios: Envio[]; alTerminar: (resultado: ResultadoLote) => void; alCancelar: () => void }) {
  const pedirConfirmacion = useConfirmar();
  const avisar = useAviso();
  const [guias, setGuias] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function despachar() {
    const incompletos = envios.filter((envio) => (guias[envio.id] ?? '').trim().length < 3);
    if (incompletos.length > 0) {
      setError(`Falta la guía de ${incompletos.length} ${incompletos.length === 1 ? 'envío' : 'envíos'} (mínimo 3 caracteres).`);
      return;
    }
    const aceptado = await pedirConfirmacion({
      titulo: `¿Despachar ${envios.length} ${envios.length === 1 ? 'envío' : 'envíos'}?`,
      pregunta: 'Cada envío pasará a «En ruta» con la guía que escribiste.',
      accion: `Sí, despachar ${envios.length}`,
    });
    if (!aceptado) return;
    setOcupado(true);
    setError(null);
    try {
      const pedidos = envios.map((envio) => ({ envioId: envio.id, guia: (guias[envio.id] ?? '').trim() }));
      const resultados: ResultadoLote[] = [];
      for (const trozo of trozosDe(pedidos, LIMITE_LOTE_DESPACHO)) {
        resultados.push(await api.post<ResultadoLote>('/staff/envios/despachar-lote', { items: trozo }));
      }
      avisar('Despacho en lote terminado.');
      alTerminar(sumarResultados(resultados));
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="tarjeta mb-4 space-y-3 p-4" aria-label="Despachar envíos seleccionados">
      <h2 className="text-xl">Despachar {envios.length} {envios.length === 1 ? 'envío' : 'envíos'}</h2>
      <p className="text-sm text-suave">Escribe la guía de cada uno. La foto de la guía se sube desde el envío, si la necesitas.</p>
      <ul className="space-y-2">
        {envios.map((envio) => (
          <li key={envio.id} className="grid items-end gap-2 sm:grid-cols-[1fr_16rem]">
            <p className="text-sm"><b>{nombreEnvio(envio)}</b> · {envio.cliente.nombre} · {nombreTransportista(envio.transportista)}</p>
            <Campo etiqueta={`Guía de ${nombreEnvio(envio)}`} value={guias[envio.id] ?? ''} onChange={(e) => setGuias({ ...guias, [envio.id]: e.target.value })} placeholder="Número de guía" />
          </li>
        ))}
      </ul>
      {error && <Alerta tono="error">{error}</Alerta>}
      <div className="flex gap-2">
        <button type="button" className="btn btn-primario btn-chico" disabled={ocupado} onClick={() => void despachar()}>{ocupado ? 'Despachando…' : `Despachar ${envios.length}`}</button>
        <button type="button" className="btn btn-suave btn-chico" disabled={ocupado} onClick={alCancelar}>Cancelar</button>
      </div>
    </section>
  );
}

export function ListaEnvios() {
  const [params, setParams] = useSearchParams();
  const estado = params.get('estado') ?? 'ACTIVOS';
  const orden = params.get('orden') ?? 'RECIENTE';
  const q = params.get('q') ?? '';
  const pagina = Math.max(1, Number.parseInt(params.get('pagina') ?? '1', 10) || 1);
  const escritorio = useEsEscritorio();
  const [texto, setTexto] = useState(q);
  const [seleccion, setSeleccion] = useState<Map<string, Envio>>(new Map());
  const [despachando, setDespachando] = useState(false);
  const [resumen, setResumen] = useState<{ texto: string; hayFallos: boolean } | null>(null);

  const consulta = new URLSearchParams({ estado, orden });
  if (q) consulta.set('q', q);
  const enlaceCsv = `/api/staff/envios/exportar.csv?${consulta.toString()}`;
  const { datos, cargando, error, recargar } = useCarga(() => api.get<PaginaEnvios>(`/staff/envios/lista?${consulta.toString()}&pagina=${pagina}`), [estado, orden, q, pagina]);

  const cambiar = (clave: string, valor: string) => {
    const nuevos = new URLSearchParams(params);
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    if (clave !== 'pagina') nuevos.delete('pagina');
    setParams(nuevos, { replace: true });
  };

  useEffect(() => {
    const limpio = texto.trim();
    if (limpio === q) return undefined;
    const espera = setTimeout(() => cambiar('q', limpio), ESPERA_BUSQUEDA_MS);
    return () => clearTimeout(espera);
  }, [texto]);

  const envios = datos?.envios ?? [];
  const pagados = envios.filter((envio) => envio.estado === 'PAGADO');
  const todosPagadosMarcados = pagados.length > 0 && pagados.every((envio) => seleccion.has(envio.id));
  const elegidos = [...seleccion.values()];

  function alternar(envio: Envio) {
    setSeleccion((actual) => {
      const nueva = new Map(actual);
      if (nueva.has(envio.id)) nueva.delete(envio.id);
      else nueva.set(envio.id, envio);
      return nueva;
    });
  }

  function alternarPagadosDeLaPagina() {
    setSeleccion((actual) => {
      const nueva = new Map(actual);
      for (const envio of pagados) {
        if (todosPagadosMarcados) nueva.delete(envio.id);
        else nueva.set(envio.id, envio);
      }
      return nueva;
    });
  }

  function terminarDespacho(resultado: ResultadoLote) {
    setResumen({ texto: resumenDeLote(resultado, 'envío despachado', 'envíos despachados'), hayFallos: resultado.fallidos.length > 0 });
    setDespachando(false);
    setSeleccion(new Map());
    void recargar();
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Envíos</h1>
        <Link to="/panel/nuevo" className="btn btn-primario btn-chico"><FiPlus aria-hidden /> Nueva prealerta</Link>
      </div>

      <div className="mb-4 grid grid-cols-2 items-end gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_16rem]">
        <div className="col-span-2 lg:col-span-1">
          <label htmlFor="buscar-envios" className="etiqueta">Buscar</label>
          <input id="buscar-envios" className="campo" type="search" placeholder="Nombre, tracking, guía o teléfono" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <div>
          <label htmlFor="filtro-estado" className="etiqueta">Estado</label>
          <select id="filtro-estado" className="campo" value={estado} onChange={(e) => cambiar('estado', e.target.value === 'ACTIVOS' ? '' : e.target.value)}>
            <option value="ACTIVOS">Activos</option>
            <option value="TODOS">Todos</option>
            {(Object.keys(ETIQUETAS_ESTADO) as EstadoEnvio[]).map((e) => <option key={e} value={e}>{ETIQUETAS_ESTADO[e]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="orden-envios" className="etiqueta">Ordenar</label>
          <select id="orden-envios" className="campo" value={orden} onChange={(e) => cambiar('orden', e.target.value === 'RECIENTE' ? '' : e.target.value)}>
            <option value="RECIENTE">Más recientes</option>
            <option value="ANTIGUO">Más antiguos</option>
            <option value="MONTO">Mayor monto</option>
          </select>
        </div>
      </div>

      {cargando && !datos && <Cargando />}
      {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
      {datos && datos.total === 0 && <Vacio titulo="No hay envíos con esos filtros" texto="Prueba con otro estado o borra la búsqueda." />}

      {datos && datos.total > 0 && (
        <>
          <div className="sticky top-14 z-20 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-linea bg-white px-4 py-3 shadow-elevada lg:top-16">
            <p className="text-sm">
              <span className="font-bold">{datos.total}</span> {datos.total === 1 ? 'envío' : 'envíos'} · página {datos.pagina} de {datos.paginas}
              {elegidos.length > 0 && <span className="ml-3 font-bold text-marino">{elegidos.length} para despachar</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {elegidos.length > 0 && <button type="button" className="btn btn-primario btn-chico" onClick={() => setDespachando(true)}>Despachar {elegidos.length} seleccionados</button>}
              <a className="btn btn-suave btn-chico" href={enlaceCsv} download><FiDownload aria-hidden /> Descargar CSV</a>
            </div>
          </div>

          {resumen && <Alerta tono={resumen.hayFallos ? 'aviso' : 'ok'}>{resumen.texto}</Alerta>}
          {despachando && elegidos.length > 0 && <DespachoEnLote envios={elegidos} alTerminar={terminarDespacho} alCancelar={() => setDespachando(false)} />}

          {escritorio ? (
          <div className="overflow-x-auto rounded-2xl border border-linea bg-white">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-papel text-xs uppercase tracking-wide text-suave">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" aria-label="Seleccionar los envíos pagados de esta página" checked={todosPagadosMarcados} disabled={pagados.length === 0} onChange={alternarPagadosDeLaPagina} className="h-5 w-5" />
                  </th>
                  <th className="px-3 py-3">Envío</th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Llegaron</th>
                  <th className="px-3 py-3">Transporte</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-3 py-3">Creado</th>
                  <th className="px-3 py-3">Sin cambios</th>
                  <th className="px-3 py-3"><span className="sr-only">Abrir</span></th>
                </tr>
              </thead>
              <tbody>
                {envios.map((envio) => {
                  const dias = diasEnBodega(envio.actualizadoEn);
                  return (
                    <tr key={envio.id} className={`border-t border-linea ${seleccion.has(envio.id) ? 'bg-marino-50' : ''}`}>
                      <td className="px-3 py-2">
                        {envio.estado === 'PAGADO' && <input type="checkbox" aria-label={`Seleccionar ${nombreEnvio(envio)} para despachar`} checked={seleccion.has(envio.id)} onChange={() => alternar(envio)} className="h-5 w-5" />}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-bold">{nombreEnvio(envio)}</p>
                        <p className="codigo max-w-[18rem] truncate text-xs text-suave">{envio.paquetes.map((p) => p.tracking).join(' · ')}</p>
                      </td>
                      <td className="px-3 py-2">{envio.cliente.nombre}</td>
                      <td className="px-3 py-2"><InsigniaEstado estado={envio.estado} /></td>
                      <td className="px-3 py-2">{envio.paquetes.filter((p) => p.recibido).length}/{envio.paquetes.length}</td>
                      <td className="px-3 py-2">{nombreTransportista(envio.transportista)}</td>
                      <td className="px-3 py-2 text-right font-bold">{envio.precio ? formatearUsd(envio.precio.totalCentavos) : '—'}</td>
                      <td className="px-3 py-2 text-suave">{formatearFecha(envio.creadoEn)}</td>
                      <td className={`px-3 py-2 ${dias !== null && dias >= 15 ? 'font-bold text-rojo-700' : 'text-suave'}`}>{dias === null ? '—' : dias === 0 ? 'Hoy' : `${dias} d`}</td>
                      <td className="px-3 py-2 text-right"><Link to={`/panel/envios/${envio.id}`} className="btn btn-suave btn-chico">Abrir</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          ) : (
          <>
            <label className="mb-2 flex items-center gap-2 text-sm text-suave">
              <input type="checkbox" className="h-5 w-5" checked={todosPagadosMarcados} disabled={pagados.length === 0} onChange={alternarPagadosDeLaPagina} />
              Seleccionar los envíos pagados de esta página
            </label>
            <ul className="space-y-3">
              {envios.map((envio) => {
                const dias = diasEnBodega(envio.actualizadoEn);
                return (
                  <li key={envio.id} className={`tarjeta flex items-start gap-3 p-3 ${seleccion.has(envio.id) ? 'border-marino ring-2 ring-marino/20' : ''}`}>
                    {envio.estado === 'PAGADO' ? (
                      <input type="checkbox" aria-label={`Seleccionar ${nombreEnvio(envio)} para despachar`} checked={seleccion.has(envio.id)} onChange={() => alternar(envio)} className="mt-1 h-6 w-6 shrink-0" />
                    ) : (
                      <span className="w-6 shrink-0" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate font-bold">{nombreEnvio(envio)}</p>
                        <span className="shrink-0"><InsigniaEstado estado={envio.estado} /></span>
                      </div>
                      <p className="truncate text-sm">{envio.cliente.nombre}</p>
                      <p className="codigo truncate text-xs text-suave">{envio.paquetes.map((p) => p.tracking).join(' · ')}</p>
                      <p className="mt-1 text-xs text-suave">
                        {envio.paquetes.filter((p) => p.recibido).length}/{envio.paquetes.length} llegaron · {nombreTransportista(envio.transportista)}
                        {envio.precio ? <> · <b className="text-marino-900">{formatearUsd(envio.precio.totalCentavos)}</b></> : null}
                        {dias !== null && dias > 0 ? ` · hace ${dias} d` : ''}
                      </p>
                      <Link to={`/panel/envios/${envio.id}`} className="btn btn-suave btn-chico mt-2">Abrir</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
          )}

          <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Páginas de envíos">
            <button type="button" className="btn btn-suave btn-chico" disabled={datos.pagina <= 1} onClick={() => cambiar('pagina', String(datos.pagina - 1))}>Anterior</button>
            <p className="text-sm text-suave">Página {datos.pagina} de {datos.paginas}</p>
            <button type="button" className="btn btn-suave btn-chico" disabled={datos.pagina >= datos.paginas} onClick={() => cambiar('pagina', String(datos.pagina + 1))}>Siguiente</button>
          </nav>
        </>
      )}
    </div>
  );
}
