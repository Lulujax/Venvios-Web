import { Link } from 'react-router-dom';
import { PagosPersonal } from '../../components/envio/PagosPersonal';
import { Cargando, ErrorCarga, Vacio } from '../../components/ui';
import { api } from '../../lib/api';
import { formatearBs, formatearUsd } from '../../lib/formato';
import type { Envio } from '../../lib/tipos';
import { useCarga } from '../../lib/useCarga';

export default function PagosPendientes() {
  const { datos, setDatos, cargando, error, recargar } = useCarga(() => api.get<{ envios: Envio[] }>('/envios?estado=POR_CONFIRMAR').then((r) => r.envios));

  function reemplazar(nuevo: Envio) {
    setDatos((actuales) => (actuales ?? []).map((e) => (e.id === nuevo.id ? nuevo : e)).filter((e) => e.estado === 'POR_CONFIRMAR'));
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="mb-1 text-3xl">Pagos por confirmar</h1>
      <p className="mb-6 text-suave">Revisa el comprobante, confirma o rechaza. Al confirmar un pago completo se abre WhatsApp para pedir los datos de entrega.</p>
      {cargando && <Cargando />}
      {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
      {datos && datos.length === 0 && <Vacio titulo="Todo al día" texto="No hay comprobantes esperando revisión." />}
      <div className="space-y-5">
        {datos?.map((envio) => (
          <section key={envio.id} className="tarjeta p-4 sm:p-5">
            <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-display text-xl font-bold text-marino-900">{envio.cliente.nombre}</p>
                <p className="text-sm text-suave">Debe {envio.precio ? formatearUsd(envio.precio.totalCentavos - envio.pagadoCentavos) : '—'}{envio.precio?.totalBsCentavos != null ? ` · ${formatearBs(envio.precio.totalBsCentavos)}` : ''}</p>
              </div>
              <Link to={`/panel/envios/${envio.id}`} className="btn btn-suave btn-chico">Abrir envío</Link>
            </header>
            <PagosPersonal envio={envio} alCambiar={reemplazar} />
          </section>
        ))}
      </div>
    </div>
  );
}
