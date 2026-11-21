import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiCheckSquare, FiSquare } from 'react-icons/fi';
import { CambiarDueno, DescartarPaquete } from '../../components/envio/AccionesPaquete';
import { PieTandas, useTandas } from '../../components/Tandas';
import { ElegirModalidad, ElegirTransportista } from '../../components/OpcionesEnvio';
import { Alerta, Campo, Cargando, ErrorCarga, InsigniaEstado, Vacio } from '../../components/ui';
import { api, mensajeDeError } from '../../lib/api';
import { aNumero, diasEnBodega, formatearKg, textoAntiguedad } from '../../lib/formato';
import type { Envio, ItemBodega, Modalidad, Transportista } from '../../lib/tipos';
import { useCarga } from '../../lib/useCarga';

type Accion = { paqueteId: string; tipo: 'dueno' | 'descartar' } | null;

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
    <form onSubmit={enviar} className="tarjeta space-y-4 p-5" noValidate aria-labelledby="titulo-consolidar">
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

export default function Bodega() {
  const [params, setParams] = useSearchParams();
  const sinDueno = params.get('sinDueno') === '1';
  const q = params.get('q') ?? '';
  const consulta = new URLSearchParams();
  if (sinDueno) consulta.set('sinDueno', '1');
  if (q) consulta.set('q', q);
  const { datos, cargando, error, recargar } = useCarga(() => api.get<{ paquetes: ItemBodega[] }>(`/staff/bodega?${consulta.toString()}`).then((r) => r.paquetes), [sinDueno, q]);
  const [accion, setAccion] = useState<Accion>(null);
  const [elegidos, setElegidos] = useState<string[]>([]);

  const cambiar = (clave: string, valor: string) => {
    const nuevos = new URLSearchParams(params);
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    setParams(nuevos, { replace: true });
  };

  const items = datos ?? [];
  const tandas = useTandas(items);
  const seleccion = items.filter((i) => elegidos.includes(i.paqueteId));

  function alternar(item: ItemBodega) {
    setElegidos((actuales) => {
      if (actuales.includes(item.paqueteId)) return actuales.filter((id) => id !== item.paqueteId);
      const mismoCliente = items.filter((i) => actuales.includes(i.paqueteId)).every((i) => i.cliente.id === item.cliente.id);
      return mismoCliente ? [...actuales, item.paqueteId] : [item.paqueteId];
    });
  }

  async function terminarAccion() {
    setAccion(null);
    setElegidos([]);
    await recargar();
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-5">
        <h1 className="text-3xl">Bodega</h1>
        <p className="mt-1 text-suave">Todo lo que está en la oficina y aún no sale a Venezuela, del más viejo al más nuevo.</p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor="buscar-bodega" className="sr-only">Buscar en bodega</label>
          <input id="buscar-bodega" className="campo" type="search" placeholder="Buscar por tracking, cliente o casillero" defaultValue={q} onChange={(e) => cambiar('q', e.target.value.trim())} />
        </div>
        <div className="flex gap-2" role="group" aria-label="Filtrar">
          <button type="button" aria-pressed={!sinDueno} className={`btn ${!sinDueno ? 'btn-primario' : 'btn-suave'}`} onClick={() => cambiar('sinDueno', '')}>Todos</button>
          <button type="button" aria-pressed={sinDueno} className={`btn ${sinDueno ? 'btn-primario' : 'btn-suave'}`} onClick={() => cambiar('sinDueno', '1')}>Sin dueño</button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          {cargando && !datos && <Cargando />}
          {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
          {datos && items.length === 0 && <Vacio titulo={sinDueno ? 'No hay paquetes sin dueño' : 'La bodega está vacía'} texto={q ? 'Prueba con otra búsqueda.' : 'Lo que escanees aparecerá aquí.'} />}
          <ul className="space-y-3">
            {tandas.visibles.map((item) => {
              const dias = diasEnBodega(item.recibidoEn);
              const seleccionable = !item.sinDueno && item.tipoEnvio === 'ALERTA';
              const marcado = elegidos.includes(item.paqueteId);
              const abierta = accion?.paqueteId === item.paqueteId ? accion.tipo : null;
              return (
                <li key={item.paqueteId} className={`tarjeta p-4 ${marcado ? 'border-marino ring-2 ring-marino/20' : ''}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    {seleccionable ? (
                      <label className="mt-0.5 cursor-pointer text-2xl text-marino">
                        <input type="checkbox" className="sr-only" checked={marcado} onChange={() => alternar(item)} aria-label={`Elegir ${item.tracking} para consolidar`} />
                        {marcado ? <FiCheckSquare aria-hidden /> : <FiSquare className="text-suave" aria-hidden />}
                      </label>
                    ) : (
                      <span className="w-6" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="codigo truncate text-base">{item.tracking}</p>
                      <p className="text-sm">
                        {item.sinDueno ? <span className="insignia bg-rojo-100 text-rojo-700">Sin dueño</span> : <><b>{item.cliente.nombre}</b> · <span className="codigo">{item.cliente.codigo}</span></>}
                      </p>
                      <p className={`mt-1 text-xs font-bold ${dias !== null && dias >= 15 ? 'text-rojo-700' : 'text-suave'}`}>
                        {textoAntiguedad(dias)}{item.pesoKg ? ` · ${formatearKg(item.pesoKg)}` : ''}
                      </p>
                    </div>
                    <InsigniaEstado estado={item.estadoEnvio} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 pl-9">
                    <Link to={`/panel/envios/${item.envioId}`} className="btn btn-suave btn-chico">Abrir</Link>
                    {item.tipoEnvio === 'ALERTA' && <button type="button" className="btn btn-suave btn-chico" onClick={() => setAccion(abierta === 'dueno' ? null : { paqueteId: item.paqueteId, tipo: 'dueno' })}>{item.sinDueno ? 'Asignar dueño' : 'Cambiar dueño'}</button>}
                    {item.tipoEnvio === 'ALERTA' && <button type="button" className="btn btn-fantasma btn-chico text-rojo-700" onClick={() => setAccion(abierta === 'descartar' ? null : { paqueteId: item.paqueteId, tipo: 'descartar' })}>Descartar</button>}
                  </div>
                  {abierta === 'dueno' && <div className="mt-3"><CambiarDueno paqueteId={item.paqueteId} tracking={item.tracking} sinDueno={item.sinDueno} alTerminar={() => void terminarAccion()} alCancelar={() => setAccion(null)} /></div>}
                  {abierta === 'descartar' && <div className="mt-3"><DescartarPaquete paqueteId={item.paqueteId} tracking={item.tracking} alTerminar={() => void terminarAccion()} alCancelar={() => setAccion(null)} /></div>}
                </li>
              );
            })}
          </ul>
          <PieTandas total={tandas.total} mostrados={tandas.mostrados} hayMas={tandas.hayMas} verMas={tandas.verMas} />
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          {seleccion.length > 0 ? (
            <FormularioConsolidar key={seleccion.map((s) => s.paqueteId).join('-')} elegidos={seleccion} alTerminar={() => setElegidos([])} />
          ) : (
            <p className="rounded-tarjeta border border-dashed border-linea p-5 text-sm text-suave">Marca paquetes de un mismo cliente para consolidarlos en su nombre.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
