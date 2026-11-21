import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft, FiPhone } from 'react-icons/fi';
import { AjusteAdmin } from '../components/envio/AjusteAdmin';
import { DespachoForm } from '../components/envio/DespachoForm';
import { EntregaForm } from '../components/envio/EntregaForm';
import { EntregaDelPerfil } from '../components/envio/EntregaDelPerfil';
import { Historial } from '../components/envio/Historial';
import { LineaEstado } from '../components/envio/LineaEstado';
import { SeguimientoEnvio } from '../components/envio/SeguimientoPaquete';
import { SelectorModalidad } from '../components/envio/ModalidadYValor';
import { PagoCliente } from '../components/envio/PagoCliente';
import { ListaPagos, PagosPersonal } from '../components/envio/PagosPersonal';
import { PaquetesCliente, PaquetesPersonal } from '../components/envio/PaquetesLista';
import { PrecioCaja } from '../components/envio/PrecioCaja';
import { PasosConsolidacion } from '../components/envio/Consolidado';
import { Alerta, Campo, Cargando, ErrorCarga, ImagenPrivada, InsigniaEstado, Seccion, useAviso } from '../components/ui';
import { api, mensajeDeError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatearUsd, nombreEnvio, nombreTransportista } from '../lib/formato';
import type { Envio } from '../lib/tipos';
import { useCarga } from '../lib/useCarga';
import { enlaceRastreo } from '../lib/whatsapp';

const ESTADOS_ALERTA_ACTIVOS = ['PREALERTADO', 'RECIBIDO_PARCIAL', 'RECIBIDO_COMPLETO'];
const ESTADOS_CONSOLIDADO_ABIERTOS = ['POR_CONSOLIDAR', 'POR_PAGAR'];
const ESTADOS_DE_ENVIO = ['PAGADO', 'DESPACHADO', 'CERRADO'];
const ESTADOS_CON_PAGO_REGISTRADO = ['POR_CONFIRMAR', 'PAGADO'];

function tituloDe(envio: Envio): string {
  if (envio.tipo === 'CONSOLIDADO' || envio.tienda === 'Sin prealerta' || envio.tienda === 'Devuelto a bodega') return nombreEnvio(envio);
  return `Alerta de ${envio.tienda}`;
}

export function YaLoRecibi({ envio, alCambiar }: { envio: Envio; alCambiar: (envio: Envio) => void }) {
  const avisar = useAviso();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    if (!window.confirm('¿Ya recibiste tu envío? Al confirmarlo lo damos por entregado.')) return;
    setOcupado(true);
    setError(null);
    try {
      const r = await api.post<{ envio: Envio }>(`/envios/${envio.id}/recibido`);
      alCambiar(r.envio);
      avisar('Gracias por confirmar. Tu envío quedó como entregado.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mt-5 space-y-2 border-t border-linea pt-4">
      <p className="text-sm text-suave">Cuando tengas tu paquete en la mano, confírmalo aquí.</p>
      <button type="button" className="btn btn-acento" disabled={ocupado} onClick={() => void confirmar()}>{ocupado ? 'Confirmando…' : 'Ya lo recibí'}</button>
      {error && <Alerta tono="error">{error}</Alerta>}
    </div>
  );
}

function DescartarEnvio({ envio, alCambiar }: { envio: Envio; alCambiar: (envio: Envio) => void }) {
  const avisar = useAviso();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const esConsolidado = envio.tipo === 'CONSOLIDADO';

  async function confirmar() {
    if (motivo.trim().length < 3) return setError('Escribe el motivo (mínimo 3 letras).');
    setError(null);
    try {
      const r = await api.post<{ envio: Envio }>(`/staff/envios/${envio.id}/cancelar`, { motivo: motivo.trim() });
      alCambiar(r.envio);
      setAbierto(false);
      avisar(esConsolidado ? 'Consolidado deshecho: los paquetes volvieron a la bodega.' : 'Alerta descartada.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    }
  }

  if (!abierto) {
    return <button type="button" className="btn btn-fantasma text-rojo-700" onClick={() => setAbierto(true)}>{esConsolidado ? 'Deshacer este consolidado…' : 'Descartar esta alerta completa…'}</button>;
  }
  return (
    <div className="space-y-3 rounded-2xl border border-rojo/30 bg-rojo-100/50 p-4">
      <p className="text-sm font-semibold text-rojo-700">{esConsolidado ? 'Los paquetes vuelven a la bodega del cliente.' : 'Se descartan todos los paquetes de esta alerta.'}</p>
      <Campo etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} error={error} />
      <div className="flex gap-2">
        <button type="button" className="btn btn-peligro btn-chico" onClick={() => void confirmar()}>{esConsolidado ? 'Deshacer consolidado' : 'Descartar alerta'}</button>
        <button type="button" className="btn btn-suave btn-chico" onClick={() => setAbierto(false)}>Volver</button>
      </div>
    </div>
  );
}

function DeshacerCliente({ envio, alCambiar }: { envio: Envio; alCambiar: (envio: Envio) => void }) {
  const avisar = useAviso();
  const [error, setError] = useState<string | null>(null);

  async function deshacer() {
    if (!window.confirm('¿Deshacer este envío? Tus paquetes vuelven a la bodega y puedes armarlo de nuevo.')) return;
    setError(null);
    try {
      const r = await api.post<{ envio: Envio }>(`/envios/${envio.id}/deshacer`, {});
      alCambiar(r.envio);
      avisar('Listo: tus paquetes volvieron a la bodega.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" className="btn btn-fantasma text-rojo-700" onClick={() => void deshacer()}>Deshacer este envío</button>
      {error && <Alerta tono="error">{error}</Alerta>}
    </div>
  );
}

function VerPaquetes({ envio, alCambiar }: { envio: Envio; alCambiar: (envio: Envio) => void }) {
  return (
    <details className="tarjeta p-5 sm:p-6">
      <summary className="cursor-pointer text-lg font-bold text-marino-900">Ver los {envio.paquetes.length} paquete(s) del envío</summary>
      <div className="mt-4"><PaquetesPersonal envio={envio} alCambiar={alCambiar} /></div>
    </details>
  );
}

export default function DetalleEnvio({ personal }: { personal: boolean }) {
  const { id } = useParams();
  const { usuario } = useAuth();
  const { datos, setDatos, cargando, error, recargar } = useCarga(() => api.get<{ envio: Envio }>(`/envios/${id}`).then((r) => r.envio), [id]);

  if (cargando && !datos) return <div className="contenedor py-8"><Cargando /></div>;
  if (error || !datos) return <div className="contenedor py-8"><ErrorCarga mensaje={error ?? 'No encontramos ese envío.'} reintentar={() => void recargar()} /></div>;

  const envio = datos;
  const alCambiar = (nuevo: Envio) => setDatos(nuevo);
  const esAlerta = envio.tipo === 'ALERTA';
  const alertaActiva = esAlerta && ESTADOS_ALERTA_ACTIVOS.includes(envio.estado);
  const consolidadoAbierto = !esAlerta && ESTADOS_CONSOLIDADO_ABIERTOS.includes(envio.estado);
  const sinPagosVivos = envio.pagos.every((p) => p.estado === 'RECHAZADO');
  const puedePagar = !esAlerta && envio.precio !== null && ['POR_PAGAR', 'POR_CONFIRMAR'].includes(envio.estado);
  const hayEnBodega = alertaActiva && envio.paquetes.some((p) => p.recibido);
  const transportista = nombreTransportista(envio.transportista);
  const volver = personal ? (esAlerta ? '/panel/bodega' : '/panel/envios') : esAlerta ? '/cuenta/mis-envios?pestana=PREALERTAS' : '/cuenta/mis-envios?pestana=ACTIVOS';

  const etapaConsolidar = personal && consolidadoAbierto;
  const etapaPago = personal && !esAlerta && envio.estado === 'POR_CONFIRMAR';
  const etapaEnvio = personal && !esAlerta && ESTADOS_DE_ENVIO.includes(envio.estado);
  const conPanelLateral = !etapaConsolidar;
  const mostrarCorreccionAdmin = personal && usuario?.rol === 'ADMIN' && !esAlerta && ESTADOS_CON_PAGO_REGISTRADO.includes(envio.estado);

  return (
    <div className="contenedor py-6 sm:py-8">
      <Link to={volver} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-marino"><FiArrowLeft aria-hidden /> Volver</Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl">{tituloDe(envio)}</h1>
          <p className="mt-1 text-sm text-suave">
            {envio.paquetes.length} paquete(s)
            {!esAlerta && ` · ${transportista}`}
            {personal && !envio.sinDueno && ` · ${envio.cliente.nombre}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {envio.sinDueno && <span className="insignia bg-rojo-100 text-rojo-700">Sin dueño</span>}
          <InsigniaEstado estado={envio.estado} />
        </div>
      </header>

      {!esAlerta && <div className="mb-6 rounded-tarjeta border border-linea bg-white p-4"><LineaEstado estado={envio.estado} /></div>}

      <div className={conPanelLateral ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]' : 'max-w-3xl'}>
        <div className="space-y-6">
          {personal && !envio.sinDueno && (
            <Seccion titulo="Cliente">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <p className="text-lg font-bold">{envio.cliente.nombre}</p>
                  <p className="text-suave"><span className="codigo">{envio.cliente.codigo}</span> · Cédula {envio.cliente.cedulaEnmascarada}</p>
                </div>
                <a href={`tel:+${envio.cliente.telefono}`} className="btn btn-suave btn-chico"><FiPhone aria-hidden /> +{envio.cliente.telefono}</a>
              </div>
            </Seccion>
          )}
          {personal && envio.sinDueno && <Alerta tono="aviso">Este paquete está en bodega sin dueño. Asígnalo cuando sepas de quién es, o espera a que el cliente lo reclame con su alerta.</Alerta>}

          {etapaConsolidar && <PasosConsolidacion key={envio.id} envio={envio} alCambiar={alCambiar} />}

          {etapaPago && <VerPaquetes envio={envio} alCambiar={alCambiar} />}

          {!personal && !esAlerta && (
            <Seccion titulo="Seguimiento del envío">
              <SeguimientoEnvio envio={envio} />
              {envio.guia.numero && <p className="mt-4 text-sm">Guía de {transportista}: <span className="codigo">{envio.guia.numero}</span></p>}
            </Seccion>
          )}

          {(esAlerta || !personal) && (
            <Seccion
              titulo="Paquetes"
              derecha={esAlerta && envio.faltan > 0 ? <span className="insignia bg-oro-100 text-marino-900">Faltan {envio.faltan}</span> : esAlerta ? <span className="insignia bg-verde-100 text-verde">Todos llegaron</span> : undefined}
            >
              {personal ? <PaquetesPersonal envio={envio} alCambiar={alCambiar} /> : <PaquetesCliente paquetes={envio.paquetes} etiquetaEnvio={esAlerta ? undefined : envio.etiquetaEstado} />}
              {!personal && hayEnBodega && (
                <div className="mt-4 rounded-2xl bg-oro-50 p-4">
                  <p className="text-sm font-semibold text-marino-900">Tienes paquetes en bodega.</p>
                  <p className="text-sm text-suave">Elige cuáles se envían juntos para que los pesemos y te demos el total.</p>
                  <Link to="/cuenta/consolidar" className="btn btn-acento btn-chico mt-3">Consolidar envío</Link>
                </div>
              )}
            </Seccion>
          )}

          {!personal && consolidadoAbierto && (
            <Seccion titulo="Modalidad de cobro">
              <SelectorModalidad envio={envio} alCambiar={alCambiar} />
            </Seccion>
          )}

          {(puedePagar || envio.pagos.length > 0) && (
            <Seccion titulo={personal ? 'Pagos' : puedePagar ? 'Pagar este envío' : 'Tus pagos'}>
              {personal ? <PagosPersonal envio={envio} alCambiar={alCambiar} /> : puedePagar ? <PagoCliente envio={envio} alCambiar={alCambiar} /> : <ListaPagos pagos={envio.pagos} />}
              {!personal && puedePagar && envio.pagos.length > 0 && <div className="mt-5"><h3 className="mb-2 text-base">Tus pagos</h3><ListaPagos pagos={envio.pagos} /></div>}
            </Seccion>
          )}

          {((!personal && !esAlerta && envio.estado !== 'CANCELADO') || etapaEnvio) && (
            <Seccion titulo="Datos de entrega en Venezuela">
              {personal ? (
                <EntregaForm key={`${envio.entrega.cedula}-${envio.estado}`} envio={envio} alCambiar={alCambiar} bloqueado={['DESPACHADO', 'CERRADO', 'CANCELADO'].includes(envio.estado)} />
              ) : (
                <EntregaDelPerfil envio={envio} alCambiar={alCambiar} bloqueado={['DESPACHADO', 'CERRADO', 'CANCELADO'].includes(envio.estado)} />
              )}
            </Seccion>
          )}

          {!personal && (envio.estado === 'DESPACHADO' || envio.estado === 'CERRADO') && (envio.guia.numero || envio.guia.tieneFoto) && (
            <Seccion titulo="Tu guía de Venezuela">
              <p className="text-sm text-suave">{transportista}</p>
              {envio.guia.numero && <p className="codigo text-2xl">{envio.guia.numero}</p>}
              {envio.guia.tieneFoto && <div className="mt-4"><ImagenPrivada ruta={envio.guia.fotoRuta} alt="Foto de la guía" className="max-h-80 w-full object-contain bg-papel sm:w-auto" /></div>}
              {envio.guia.numero && <a className="btn btn-primario mt-4" target="_blank" rel="noopener noreferrer" href={enlaceRastreo(envio.transportista === 'ZOOM' ? 'https://zoom.red/tracking-de-envios-personas/' : 'https://mrwve.com', null, envio.guia.numero)}>Rastrear en {transportista}</a>}
              {envio.estado === 'DESPACHADO' && <YaLoRecibi envio={envio} alCambiar={alCambiar} />}
            </Seccion>
          )}

          {etapaEnvio && <Seccion titulo="Despacho"><DespachoForm envio={envio} alCambiar={alCambiar} /></Seccion>}

          {(etapaEnvio || (personal && !esAlerta && !etapaConsolidar && !etapaPago)) && <VerPaquetes envio={envio} alCambiar={alCambiar} />}

          {!personal && consolidadoAbierto && sinPagosVivos && <DeshacerCliente envio={envio} alCambiar={alCambiar} />}

          {personal && (
            <div className="space-y-3">
              <Historial envioId={envio.id} />
              {(alertaActiva || (consolidadoAbierto && sinPagosVivos)) && <DescartarEnvio envio={envio} alCambiar={alCambiar} />}
              {mostrarCorreccionAdmin && <AjusteAdmin envio={envio} alCambiar={alCambiar} />}
            </div>
          )}
        </div>

        {conPanelLateral && (
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            {!esAlerta && (!personal || envio.precio !== null) && <PrecioCaja envio={envio} />}
            <div className="rounded-2xl border border-linea bg-white p-4 text-sm">
              <p className="flex justify-between"><span className="text-suave">Valor declarado</span><b>{formatearUsd(envio.valorDeclaradoCentavos)}</b></p>
              {!esAlerta && <p className="mt-1 flex justify-between"><span className="text-suave">Transportista</span><b>{transportista}</b></p>}
              {esAlerta && <p className="mt-2 text-suave">El precio se calcula cuando los paquetes se consolidan y se pesan juntos.</p>}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
