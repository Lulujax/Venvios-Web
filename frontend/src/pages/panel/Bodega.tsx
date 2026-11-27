import { Fragment, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiDownload } from 'react-icons/fi';
import { BuscadorCliente } from '../../components/BuscadorCliente';
import { useConfirmar } from '../../components/Confirmar';
import { CambiarDueno, DescartarPaquete } from '../../components/envio/AccionesPaquete';
import { ElegirModalidad, ElegirTransportista } from '../../components/OpcionesEnvio';
import { PieTandas, useTandas } from '../../components/Tandas';
import { Alerta, Campo, Cargando, ErrorCarga, InsigniaEstado, Vacio, useAviso } from '../../components/ui';
import { api, mensajeDeError } from '../../lib/api';
import { aNumero, formatearFecha, formatearKg, textoAntiguedad } from '../../lib/formato';
import { resumenDeLote, sumarResultados, trozosDe, type ResultadoLote } from '../../lib/lotes';
import type { Envio, ItemBodega, Modalidad, Transportista, Usuario } from '../../lib/tipos';
import { useEsEscritorio } from '../../lib/pantalla';
import { useCarga } from '../../lib/useCarga';

const LIMITE_LOTE = 100;
const FILAS_POR_TANDA = 100;
const DIAS_ALERTA = 15;

type Mostrar = '' | 'SIN_DUENO' | 'SIN_AVISAR';
type Orden = 'RECIENTE' | 'ANTIGUO';
type Accion = { paqueteId: string; tipo: 'dueno' | 'descartar' } | null;
type Panel = 'asignar' | 'consolidar' | null;

function normalizar(texto: string): string {
  return texto.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function coincide(item: ItemBodega, busqueda: string): boolean {
  const q = busqueda.trim().toLowerCase();
  if (!q) return true;
  const claro = normalizar(q);
  return item.cliente.nombre.toLowerCase().includes(q) || item.cliente.codigo.toLowerCase().includes(q) || (claro.length > 0 && normalizar(item.tracking).includes(claro));
}

function FormularioConsolidar({ elegidos, alTerminar }: { elegidos: ItemBodega[]; alTerminar: () => void }) {
  const navegar = useNavigate();
  const [modalidad, setModalidad] = useState<Modalidad>('M1');
  const [transportista, setTransportista] = useState<Transportista>('MRW');
  const [peso, setPeso] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const cliente = elegidos[0]!.cliente;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const pesoKg = peso.trim() ? aNumero(peso) : undefined;
    if (pesoKg !== undefined && (!Number.isFinite(pesoKg) || pesoKg <= 0)) return setError('El peso debe ser mayor que cero, o déjalo vacío para pesarlo después.');
    setOcupado(true);
    setError(null);
    try {
      const r = await api.post<{ envio: Envio }>('/envios/consolidar', { clienteId: cliente.id, paqueteIds: elegidos.map((e) => e.paqueteId), modalidad, transportista, pesoKg });
      alTerminar();
      navegar(`/panel/envios/${r.envio.id}`);
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={enviar} className="tarjeta mb-4 space-y-4 p-5" noValidate aria-labelledby="titulo-consolidar">
      <h2 id="titulo-consolidar" className="text-xl">Consolidar para {cliente.nombre}</h2>
      <p className="text-sm text-suave">{elegidos.length} paquete(s) elegidos. Usa esto cuando lo acuerdas con el cliente por WhatsApp.</p>
      <ElegirTransportista valor={transportista} alCambiar={setTransportista} nombre="transportista-bodega" />
      <ElegirModalidad valor={modalidad} alCambiar={setModalidad} nombre="modalidad-bodega" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Peso total (kg)" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="Vacío si lo pesas después" />
      </div>
      {error && <Alerta tono="error">{error}</Alerta>}
      <button type="submit" className="btn btn-primario" disabled={ocupado}>{ocupado ? 'Consolidando…' : peso.trim() ? 'Consolidar y calcular total' : 'Consolidar'}</button>
    </form>
  );
}

function AsignarEnLote({ elegidos, alTerminar, alCancelar }: { elegidos: ItemBodega[]; alTerminar: (resultado: ResultadoLote) => void; alCancelar: () => void }) {
  const pedirConfirmacion = useConfirmar();
  const [cliente, setCliente] = useState<Usuario | null>(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function asignar() {
    if (!cliente) return;
    const aceptado = await pedirConfirmacion({
      titulo: `¿Asignar ${elegidos.length} ${elegidos.length === 1 ? 'paquete' : 'paquetes'} a ${cliente.nombre}?`,
      pregunta: 'Los paquetes pasarán a la cuenta de ese cliente y quedará registrado en su historial.',
      accion: `Sí, asignar ${elegidos.length}`,
    });
    if (!aceptado) return;
    setOcupado(true);
    setError(null);
    try {
      const resultados: ResultadoLote[] = [];
      for (const trozo of trozosDe(elegidos.map((e) => e.paqueteId), LIMITE_LOTE)) {
        resultados.push(await api.post<ResultadoLote>('/staff/paquetes/asignar-lote', { ids: trozo, clienteId: cliente.id, motivo: motivo.trim() || undefined }));
      }
      alTerminar(sumarResultados(resultados));
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="tarjeta mb-4 space-y-3 p-4" aria-label="Asignar paquetes sin dueño">
      <h2 className="text-xl">Asignar {elegidos.length} {elegidos.length === 1 ? 'paquete' : 'paquetes'} a un cliente</h2>
      <BuscadorCliente cliente={cliente} onElegir={setCliente} etiqueta="Nuevo dueño" />
      <Campo etiqueta="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: las etiquetas traen el casillero del cliente" />
      {error && <Alerta tono="error">{error}</Alerta>}
      <div className="flex gap-2">
        <button type="button" className="btn btn-primario btn-chico" disabled={!cliente || ocupado} onClick={() => void asignar()}>{ocupado ? 'Asignando…' : `Asignar ${elegidos.length}`}</button>
        <button type="button" className="btn btn-suave btn-chico" disabled={ocupado} onClick={alCancelar}>Cancelar</button>
      </div>
    </section>
  );
}

export default function Bodega() {
  const avisar = useAviso();
  const pedirConfirmacion = useConfirmar();
  const escritorio = useEsEscritorio();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const mostrar = (params.get('mostrar') ?? (params.get('sinDueno') === '1' ? 'SIN_DUENO' : '')) as Mostrar;
  const dias = Number.parseInt(params.get('dias') ?? '0', 10) || 0;
  const orden = (params.get('orden') === 'ANTIGUO' ? 'ANTIGUO' : 'RECIENTE') as Orden;
  const { datos, cargando, error, recargar } = useCarga(() => api.get<{ paquetes: ItemBodega[] }>('/staff/bodega').then((r) => r.paquetes));
  const [accion, setAccion] = useState<Accion>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [resumen, setResumen] = useState<{ texto: string; hayFallos: boolean } | null>(null);
  const [errorLote, setErrorLote] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cambiar = (clave: string, valor: string) => {
    const nuevos = new URLSearchParams(params);
    nuevos.delete('sinDueno');
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    setParams(nuevos, { replace: true });
  };

  const items = datos ?? [];
  const visibles = useMemo(() => {
    const filtrados = items.filter((item) => {
      if (mostrar === 'SIN_DUENO' && !item.sinDueno) return false;
      if (mostrar === 'SIN_AVISAR' && (item.avisado || item.sinDueno)) return false;
      if (dias > 0 && (item.diasEnBodega ?? 0) < dias) return false;
      return coincide(item, q);
    });
    const recibido = (item: ItemBodega) => item.recibidoEn ?? '';
    return filtrados.sort((a, b) => (orden === 'ANTIGUO' ? recibido(a).localeCompare(recibido(b)) : recibido(b).localeCompare(recibido(a))));
  }, [items, mostrar, dias, q, orden]);
  const tandas = useTandas(visibles, FILAS_POR_TANDA);
  const elegidos = items.filter((item) => seleccion.has(item.paqueteId));
  const todosMarcados = tandas.visibles.length > 0 && tandas.visibles.every((item) => seleccion.has(item.paqueteId));

  const puedeAvisar = elegidos.length > 0 && elegidos.every((item) => !item.sinDueno);
  const puedeAsignar = elegidos.length > 0 && elegidos.every((item) => item.sinDueno && item.tipoEnvio === 'ALERTA');
  const puedeConsolidar = elegidos.length > 0 && elegidos.every((item) => !item.sinDueno && item.tipoEnvio === 'ALERTA' && item.cliente.id === elegidos[0]!.cliente.id);

  const enlaceReporte = '/panel/bodega/reporte';

  function alternar(paqueteId: string) {
    setSeleccion((actual) => {
      const nueva = new Set(actual);
      if (nueva.has(paqueteId)) nueva.delete(paqueteId);
      else nueva.add(paqueteId);
      return nueva;
    });
  }

  function alternarVisibles() {
    setSeleccion((actual) => {
      const nueva = new Set(actual);
      for (const item of tandas.visibles) {
        if (todosMarcados) nueva.delete(item.paqueteId);
        else nueva.add(item.paqueteId);
      }
      return nueva;
    });
  }

  async function terminarLote(resultado: ResultadoLote, singular: string, plural: string) {
    setResumen({ texto: resumenDeLote(resultado, singular, plural), hayFallos: resultado.fallidos.length > 0 });
    setPanel(null);
    setSeleccion(new Set());
    await recargar();
  }

  async function marcarAvisados() {
    const aceptado = await pedirConfirmacion({
      titulo: `¿Marcar ${elegidos.length} ${elegidos.length === 1 ? 'paquete' : 'paquetes'} como avisados?`,
      pregunta: 'Úsalo solo si ya les avisaste a esos clientes por tu cuenta. Quedará registrado en el historial de cada envío.',
      accion: `Sí, marcar ${elegidos.length}`,
    });
    if (!aceptado) return;
    setOcupado(true);
    setErrorLote(null);
    try {
      const resultados: ResultadoLote[] = [];
      for (const trozo of trozosDe(elegidos.map((e) => e.paqueteId), LIMITE_LOTE)) {
        resultados.push(await api.post<ResultadoLote>('/staff/paquetes/avisados-lote', { ids: trozo }));
      }
      avisar('Avisos marcados.');
      await terminarLote(sumarResultados(resultados), 'paquete marcado como avisado', 'paquetes marcados como avisados');
    } catch (falla) {
      setErrorLote(mensajeDeError(falla));
    } finally {
      setOcupado(false);
    }
  }

  async function terminarAccion() {
    setAccion(null);
    setSeleccion(new Set());
    await recargar();
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-5">
        <h1 className="text-3xl">Bodega</h1>
        <p className="mt-1 text-suave">Todo lo que está en la oficina y aún no sale a Venezuela. Marca varios paquetes para actuar sobre ellos juntos.</p>
      </div>

      <div className="mb-4 grid grid-cols-2 items-end gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem_16rem]">
        <div className="col-span-2 lg:col-span-1">
          <label htmlFor="buscar-bodega" className="etiqueta">Buscar</label>
          <input id="buscar-bodega" className="campo" type="search" placeholder="Tracking, cliente o casillero" defaultValue={q} onChange={(e) => cambiar('q', e.target.value.trim())} />
        </div>
        <div>
          <label htmlFor="mostrar-bodega" className="etiqueta">Mostrar</label>
          <select id="mostrar-bodega" className="campo" value={mostrar} onChange={(e) => cambiar('mostrar', e.target.value)}>
            <option value="">Todos</option>
            <option value="SIN_DUENO">Sin dueño</option>
            <option value="SIN_AVISAR">Sin avisar</option>
          </select>
        </div>
        <div>
          <label htmlFor="dias-bodega" className="etiqueta">Días en bodega</label>
          <select id="dias-bodega" className="campo" value={dias} onChange={(e) => cambiar('dias', e.target.value === '0' ? '' : e.target.value)}>
            <option value={0}>Cualquiera</option>
            <option value={7}>7 o más</option>
            <option value={15}>15 o más</option>
            <option value={30}>30 o más</option>
          </select>
        </div>
        <div className="col-span-2 lg:col-span-1">
          <label htmlFor="orden-bodega" className="etiqueta">Ordenar</label>
          <select id="orden-bodega" className="campo" value={orden} onChange={(e) => cambiar('orden', e.target.value === 'RECIENTE' ? '' : e.target.value)}>
            <option value="RECIENTE">Más recientes</option>
            <option value="ANTIGUO">Más antiguos (más días en bodega)</option>
          </select>
        </div>
      </div>

      {cargando && !datos && <Cargando />}
      {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
      {datos && items.length === 0 && <Vacio titulo="La bodega está vacía" texto="Lo que escanees aparecerá aquí." />}

      {datos && items.length > 0 && (
        <>
          <div className="sticky top-14 z-20 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-linea bg-white px-4 py-3 shadow-elevada lg:top-16">
            <p className="text-sm">
              <span className="font-bold">{visibles.length}</span> de {items.length} {items.length === 1 ? 'paquete' : 'paquetes'}
              {elegidos.length > 0 && <span className="ml-3 font-bold text-marino">{elegidos.length} seleccionados</span>}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {puedeAvisar && <button type="button" className="btn btn-primario btn-chico" disabled={ocupado} onClick={() => void marcarAvisados()}>Marcar {elegidos.length} como avisados</button>}
              {puedeAsignar && <button type="button" className="btn btn-primario btn-chico" onClick={() => setPanel(panel === 'asignar' ? null : 'asignar')}>Asignar {elegidos.length} a un cliente</button>}
              {puedeConsolidar && <button type="button" className="btn btn-suave btn-chico" onClick={() => setPanel(panel === 'consolidar' ? null : 'consolidar')}>Consolidar {elegidos.length}</button>}
              <Link className="btn btn-suave btn-chico" to={enlaceReporte}><FiDownload aria-hidden /> Generar reporte</Link>
            </div>
          </div>

          {elegidos.length > 0 && !puedeAvisar && !puedeAsignar && !puedeConsolidar && (
            <Alerta tono="aviso">Esta mezcla de paquetes no tiene una acción en lote. Marca solo paquetes con dueño, solo paquetes sin dueño, o paquetes de un mismo cliente para consolidar.</Alerta>
          )}
          {resumen && <Alerta tono={resumen.hayFallos ? 'aviso' : 'ok'}>{resumen.texto}</Alerta>}
          {errorLote && <Alerta tono="error">{errorLote}</Alerta>}
          {panel === 'asignar' && puedeAsignar && <AsignarEnLote key={elegidos.map((e) => e.paqueteId).join('-')} elegidos={elegidos} alCancelar={() => setPanel(null)} alTerminar={(r) => void terminarLote(r, 'paquete asignado', 'paquetes asignados')} />}
          {panel === 'consolidar' && puedeConsolidar && <FormularioConsolidar key={elegidos.map((e) => e.paqueteId).join('-')} elegidos={elegidos} alTerminar={() => setSeleccion(new Set())} />}

          {escritorio ? (
          <div className="overflow-x-auto rounded-2xl border border-linea bg-white">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="bg-papel text-xs uppercase tracking-wide text-suave">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" aria-label="Seleccionar todos los paquetes visibles" checked={todosMarcados} onChange={alternarVisibles} className="h-5 w-5" />
                  </th>
                  <th className="px-3 py-3">Tracking</th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Recibido</th>
                  <th className="px-3 py-3">En bodega</th>
                  <th className="px-3 py-3">Peso</th>
                  <th className="px-3 py-3">Avisado</th>
                  <th className="px-3 py-3">Foto</th>
                  <th className="px-3 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {tandas.visibles.map((item) => {
                  const abierta = accion?.paqueteId === item.paqueteId ? accion.tipo : null;
                  const dias = item.diasEnBodega;
                  return (
                    <Fragment key={item.paqueteId}>
                      <tr className={`border-t border-linea ${seleccion.has(item.paqueteId) ? 'bg-marino-50' : ''}`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" aria-label={`Elegir ${item.tracking}`} checked={seleccion.has(item.paqueteId)} onChange={() => alternar(item.paqueteId)} className="h-5 w-5" />
                        </td>
                        <td className="codigo px-3 py-2">{item.tracking}</td>
                        <td className="px-3 py-2">
                          {item.sinDueno ? <span className="insignia bg-rojo-100 text-rojo-700">Sin dueño</span> : <><b>{item.cliente.nombre}</b><span className="codigo block text-xs text-suave">{item.cliente.codigo}</span></>}
                        </td>
                        <td className="px-3 py-2"><InsigniaEstado estado={item.estadoEnvio} /></td>
                        <td className="px-3 py-2 text-suave">{item.recibidoEn ? formatearFecha(item.recibidoEn) : '—'}</td>
                        <td className={`px-3 py-2 ${dias !== null && dias >= DIAS_ALERTA ? 'font-bold text-rojo-700' : 'text-suave'}`}>{dias === null ? '—' : dias === 0 ? 'Hoy' : `${dias} d`}</td>
                        <td className="px-3 py-2">{item.pesoKg ? formatearKg(item.pesoKg) : '—'}</td>
                        <td className="px-3 py-2">{item.sinDueno ? '—' : item.avisado ? 'Sí' : 'No'}</td>
                        <td className="px-3 py-2">{item.tieneFoto ? 'Sí' : 'No'}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Link to={`/panel/envios/${item.envioId}`} className="btn btn-suave btn-chico">Abrir</Link>
                            {item.tipoEnvio === 'ALERTA' && <button type="button" className="btn btn-suave btn-chico" aria-expanded={abierta === 'dueno'} onClick={() => setAccion(abierta === 'dueno' ? null : { paqueteId: item.paqueteId, tipo: 'dueno' })}>{item.sinDueno ? 'Asignar dueño' : 'Cambiar dueño'}</button>}
                            {item.tipoEnvio === 'ALERTA' && <button type="button" className="btn btn-fantasma btn-chico text-rojo-700" aria-expanded={abierta === 'descartar'} onClick={() => setAccion(abierta === 'descartar' ? null : { paqueteId: item.paqueteId, tipo: 'descartar' })}>Descartar</button>}
                          </div>
                        </td>
                      </tr>
                      {abierta && (
                        <tr className="border-t border-linea bg-papel">
                          <td colSpan={10} className="px-4 py-3">
                            {abierta === 'dueno' && <CambiarDueno paqueteId={item.paqueteId} tracking={item.tracking} sinDueno={item.sinDueno} alTerminar={() => void terminarAccion()} alCancelar={() => setAccion(null)} />}
                            {abierta === 'descartar' && <DescartarPaquete paqueteId={item.paqueteId} tracking={item.tracking} alTerminar={() => void terminarAccion()} alCancelar={() => setAccion(null)} />}
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
              <input type="checkbox" className="h-5 w-5" checked={todosMarcados} onChange={alternarVisibles} />
              Seleccionar todos los paquetes visibles
            </label>
            <ul className="space-y-3">
              {tandas.visibles.map((item) => {
                const abierta = accion?.paqueteId === item.paqueteId ? accion.tipo : null;
                const dias = item.diasEnBodega;
                return (
                  <li key={item.paqueteId} className={`tarjeta p-3 ${seleccion.has(item.paqueteId) ? 'border-marino ring-2 ring-marino/20' : ''}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" aria-label={`Elegir ${item.tracking}`} checked={seleccion.has(item.paqueteId)} onChange={() => alternar(item.paqueteId)} className="mt-1 h-6 w-6 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="codigo truncate text-base">{item.tracking}</p>
                        <p className="text-sm">
                          {item.sinDueno ? <span className="insignia bg-rojo-100 text-rojo-700">Sin dueño</span> : <><b>{item.cliente.nombre}</b> · <span className="codigo">{item.cliente.codigo}</span></>}
                        </p>
                        <p className={`mt-1 text-xs font-bold ${dias !== null && dias >= DIAS_ALERTA ? 'text-rojo-700' : 'text-suave'}`}>
                          {textoAntiguedad(dias)}{item.pesoKg ? ` · ${formatearKg(item.pesoKg)}` : ''}{item.sinDueno ? '' : item.avisado ? ' · Avisado' : ' · Sin avisar'}
                        </p>
                      </div>
                      <span className="shrink-0"><InsigniaEstado estado={item.estadoEnvio} /></span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 pl-9">
                      <Link to={`/panel/envios/${item.envioId}`} className="btn btn-suave btn-chico">Abrir</Link>
                      {item.tipoEnvio === 'ALERTA' && <button type="button" className="btn btn-suave btn-chico" aria-expanded={abierta === 'dueno'} onClick={() => setAccion(abierta === 'dueno' ? null : { paqueteId: item.paqueteId, tipo: 'dueno' })}>{item.sinDueno ? 'Asignar dueño' : 'Cambiar dueño'}</button>}
                      {item.tipoEnvio === 'ALERTA' && <button type="button" className="btn btn-fantasma btn-chico text-rojo-700" aria-expanded={abierta === 'descartar'} onClick={() => setAccion(abierta === 'descartar' ? null : { paqueteId: item.paqueteId, tipo: 'descartar' })}>Descartar</button>}
                    </div>
                    {abierta === 'dueno' && <div className="mt-3"><CambiarDueno paqueteId={item.paqueteId} tracking={item.tracking} sinDueno={item.sinDueno} alTerminar={() => void terminarAccion()} alCancelar={() => setAccion(null)} /></div>}
                    {abierta === 'descartar' && <div className="mt-3"><DescartarPaquete paqueteId={item.paqueteId} tracking={item.tracking} alTerminar={() => void terminarAccion()} alCancelar={() => setAccion(null)} /></div>}
                  </li>
                );
              })}
            </ul>
          </>
          )}
          {visibles.length === 0 && <p className="mt-4 text-sm text-suave">Ningún paquete coincide con la búsqueda o los filtros.</p>}
          <PieTandas total={tandas.total} mostrados={tandas.mostrados} hayMas={tandas.hayMas} verMas={tandas.verMas} />
        </>
      )}
    </div>
  );
}
