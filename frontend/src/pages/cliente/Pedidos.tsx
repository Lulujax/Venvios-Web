import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';
import { ContenidoCuenta, EncabezadoCuenta, useEnviosCliente } from '../../components/CuentaPiezas';
import { PieTandas, useTandas } from '../../components/Tandas';
import { Cargando, ErrorCarga, InsigniaEstado, Vacio } from '../../components/ui';
import { filtrarPedidos, type FiltroPedidos } from '../../lib/cuenta';
import { formatearBs, formatearFecha, formatearUsd, nombreEnvio, nombreTransportista } from '../../lib/formato';

const FILTROS: Array<{ valor: FiltroPedidos; texto: string }> = [
  { valor: 'TODOS', texto: 'Todos' },
  { valor: 'PENDIENTES', texto: 'Pendientes de pago' },
  { valor: 'PAGADOS', texto: 'Pagados' },
];

export function Pedidos() {
  const { datos, cargando, error, recargar } = useEnviosCliente();
  const [filtro, setFiltro] = useState<FiltroPedidos>('TODOS');
  const pedidos = datos ? filtrarPedidos(datos, filtro) : [];
  const tandas = useTandas(pedidos);

  return (
    <>
      <EncabezadoCuenta titulo="Pedidos" subtitulo="Tu historial de envíos pagados y pendientes de pago." />
      <ContenidoCuenta>
        <div className="tarjeta p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar pedidos">
            {FILTROS.map((opcion) => (
              <button key={opcion.valor} type="button" aria-pressed={filtro === opcion.valor} onClick={() => setFiltro(opcion.valor)} className={`btn btn-chico ${filtro === opcion.valor ? 'btn-primario' : 'btn-suave'}`}>
                {opcion.texto}
              </button>
            ))}
          </div>

          {cargando && <Cargando />}
          {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
          {datos && pedidos.length === 0 && <Vacio titulo="Sin pedidos por aquí" texto="Cuando tus paquetes lleguen y estén listos para pagar, aparecerán en esta lista." />}

          {pedidos.length > 0 && (
            <div>
              <div className="hidden grid-cols-[1.1fr_1.2fr_1fr_1fr_28px] gap-4 border-b border-linea px-3 pb-3 text-xs font-bold uppercase tracking-wide text-suave md:grid">
                <span>Fecha</span>
                <span>Pedido</span>
                <span>Total</span>
                <span>Estado</span>
                <span />
              </div>
              <ul className="divide-y divide-linea">
                {tandas.visibles.map((envio) => (
                  <li key={envio.id}>
                    <Link to={`/cuenta/envios/${envio.id}`} className="grid items-center gap-2 px-3 py-4 hover:bg-marino-50/60 md:grid-cols-[1.1fr_1.2fr_1fr_1fr_28px] md:gap-4">
                      <span className="text-sm text-suave">{formatearFecha(envio.creadoEn)}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-marino-900">{nombreEnvio(envio)}</span>
                        <span className="block text-xs text-suave">{envio.paquetes.length} {envio.paquetes.length === 1 ? 'paquete' : 'paquetes'} · {nombreTransportista(envio.transportista)}</span>
                      </span>
                      <span className="text-sm font-bold text-marino-900">
                        {envio.precio ? formatearUsd(envio.precio.totalCentavos) : '—'}
                        {envio.precio?.totalBsCentavos != null && <span className="block text-xs font-semibold text-suave">{formatearBs(envio.precio.totalBsCentavos)}</span>}
                      </span>
                      <span><InsigniaEstado estado={envio.estado} /></span>
                      <FiChevronRight className="hidden text-suave md:block" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              <PieTandas total={tandas.total} mostrados={tandas.mostrados} hayMas={tandas.hayMas} verMas={tandas.verMas} />
            </div>
          )}
        </div>
      </ContenidoCuenta>
    </>
  );
}
