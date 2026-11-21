import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiSearch } from 'react-icons/fi';
import { ContenidoCuenta, EncabezadoCuenta, useEnviosCliente } from '../../components/CuentaPiezas';
import { LineaEstado } from '../../components/envio/LineaEstado';
import { Alerta, Cargando, ErrorCarga } from '../../components/ui';
import { formatearFecha, formatearKg, nombreEnvio, nombreTransportista } from '../../lib/formato';
import { DESCRIPCION_PASO, historialDe, rastrear, type ResultadoRastreo } from '../../lib/misEnvios';
import { enlaceRastreo } from '../../lib/whatsapp';

const RASTREO_TRANSPORTISTA: Record<string, string> = {
  MRW: 'https://mrwve.com',
  ZOOM: 'https://zoom.red/tracking-de-envios-personas/',
};

function Detalles({ resultado }: { resultado: ResultadoRastreo }) {
  const { envio, paquete } = resultado;
  const consolidado = envio.tipo === 'CONSOLIDADO';
  const llegada = paquete?.recibidoEn ?? envio.paquetes.find((p) => p.recibidoEn)?.recibidoEn ?? null;
  return (
    <section className="tarjeta p-5" aria-labelledby="titulo-detalles">
      <h2 id="titulo-detalles" className="text-xl">Detalles</h2>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-suave">{paquete ? 'Tracking' : 'Envío'}</dt>
          <dd className="codigo text-base">{paquete ? paquete.tracking : nombreEnvio(envio)}</dd>
        </div>
        {paquete && consolidado && (
          <div>
            <dt className="text-suave">Va en</dt>
            <dd className="font-bold">{nombreEnvio(envio)}</dd>
          </div>
        )}
        <div>
          <dt className="text-suave">Estado</dt>
          <dd className="font-bold">{consolidado ? envio.etiquetaEstado : paquete?.recibido ? 'En oficina' : 'Prealertado'}</dd>
        </div>
        <div>
          <dt className="text-suave">Llegada a nuestra oficina</dt>
          <dd>{llegada ? formatearFecha(llegada) : 'Todavía no llega'}</dd>
        </div>
        {envio.precio && (
          <div>
            <dt className="text-suave">Peso cobrado</dt>
            <dd>{formatearKg(envio.precio.pesoCobrableKg)}</dd>
          </div>
        )}
        {consolidado && (
          <div>
            <dt className="text-suave">Transportista en Venezuela</dt>
            <dd>{nombreTransportista(envio.transportista)}</dd>
          </div>
        )}
        {envio.guia.numero && (
          <div>
            <dt className="text-suave">Guía de {nombreTransportista(envio.transportista)}</dt>
            <dd className="codigo">{envio.guia.numero}</dd>
          </div>
        )}
      </dl>
      <div className="mt-5 flex flex-wrap gap-2">
        {envio.guia.numero && (
          <a className="btn btn-primario btn-chico" target="_blank" rel="noopener noreferrer" href={enlaceRastreo(RASTREO_TRANSPORTISTA[envio.transportista] ?? '', null, envio.guia.numero)}>
            Rastrear en {nombreTransportista(envio.transportista)}
          </a>
        )}
        <Link to={`/cuenta/envios/${envio.id}`} className="btn btn-suave btn-chico">Ver el envío completo</Link>
      </div>
    </section>
  );
}

function Historial({ resultado }: { resultado: ResultadoRastreo }) {
  const pasos = historialDe(resultado);
  return (
    <section className="tarjeta p-5" aria-labelledby="titulo-historial">
      <h2 id="titulo-historial" className="text-xl">Historial</h2>
      {pasos.length === 0 && <p className="mt-3 text-sm text-suave">Todavía no hay pasos registrados.</p>}
      <ol className="mt-4 space-y-5 border-l-2 border-marino pl-5">
        {pasos.map((paso, indice) => (
          <li key={`${paso.tipo}-${paso.fecha}`} className="relative">
            <span aria-hidden className={`absolute -left-[1.85rem] top-1 h-4 w-4 rounded-full ${indice === 0 ? 'bg-oro ring-4 ring-oro/30' : 'bg-marino'}`} />
            <p className="font-bold text-marino-900">{paso.etiqueta}</p>
            <p className="text-sm text-suave">{DESCRIPCION_PASO[paso.tipo] ?? ''}</p>
            <p className="text-xs text-suave">{formatearFecha(paso.fecha)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Rastrear() {
  const { datos, cargando, error, recargar } = useEnviosCliente();
  const [params, setParams] = useSearchParams();
  const consulta = params.get('q') ?? '';
  const [texto, setTexto] = useState(consulta);
  const resultado = datos && consulta ? rastrear(datos, consulta) : null;

  function buscar(evento: FormEvent) {
    evento.preventDefault();
    const limpio = texto.trim();
    setParams(limpio ? { q: limpio } : {}, { replace: true });
  }

  return (
    <>
      <EncabezadoCuenta titulo="Rastrear" subtitulo="Escribe tu tracking o el número de tu consolidación." />
      <ContenidoCuenta>
        <form onSubmit={buscar} className="tarjeta mb-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-end" role="search">
          <div className="flex-1">
            <label htmlFor="consulta-rastreo" className="etiqueta">Tracking o número de consolidación</label>
            <input id="consulta-rastreo" className="campo" type="search" autoComplete="off" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primario" disabled={texto.trim().length === 0}><FiSearch aria-hidden /> Rastrear</button>
        </form>

        {cargando && !datos && <Cargando />}
        {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
        {datos && consulta && !resultado && <Alerta tono="aviso">No encontramos información de «{consulta}» entre tus envíos. Revisa el número e intenta de nuevo.</Alerta>}

        {resultado && (
          <div className="space-y-6">
            {resultado.envio.tipo === 'CONSOLIDADO' && (
              <div className="rounded-tarjeta border border-linea bg-white p-4"><LineaEstado estado={resultado.envio.estado} /></div>
            )}
            <div className="grid gap-6 lg:grid-cols-2">
              <Detalles resultado={resultado} />
              <Historial resultado={resultado} />
            </div>
          </div>
        )}
      </ContenidoCuenta>
    </>
  );
}
