import { useState } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { ContenidoCuenta, EncabezadoCuenta, useEnviosCliente } from '../../components/CuentaPiezas';
import { PagoCliente } from '../../components/envio/PagoCliente';
import { Cargando, ErrorCarga, InsigniaEstado, Vacio } from '../../components/ui';
import { esCobrable, saldoPendienteCentavos } from '../../lib/cuenta';
import { NOMBRE_METODO, formatearBs, formatearFecha, formatearUsd, nombreEnvio } from '../../lib/formato';
import type { Envio } from '../../lib/tipos';

function saldoEnBs(envio: Envio): number | null {
  if (!envio.tasa) return null;
  return Math.round(saldoPendienteCentavos(envio) * envio.tasa.bolivaresPorUsd);
}

export function Finanzas() {
  const { datos, setDatos, cargando, error, recargar } = useEnviosCliente();
  const [abierto, setAbierto] = useState<string | null>(null);
  const cobrables = datos?.filter(esCobrable) ?? [];
  const pagos = (datos ?? []).flatMap((envio) => envio.pagos.map((pago) => ({ pago, envio }))).sort((a, b) => b.pago.creadoEn.localeCompare(a.pago.creadoEn));

  function reemplazar(actualizado: Envio) {
    setDatos((actuales) => actuales?.map((envio) => (envio.id === actualizado.id ? actualizado : envio)) ?? actuales);
  }

  return (
    <>
      <EncabezadoCuenta titulo="Finanzas" subtitulo="Paga los envíos que ya llegaron y tienen su total calculado." />
      <ContenidoCuenta>
        {cargando && <Cargando />}
        {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}

        {datos && (
          <section className="tarjeta p-5 sm:p-6" aria-labelledby="titulo-por-pagar">
            <h2 id="titulo-por-pagar" className="mb-4 text-xl">Por pagar</h2>
            {cobrables.length === 0 ? (
              <Vacio titulo="Nada por pagar" texto="Cuando un envío llegue completo a la oficina y tenga su total, aparecerá aquí." />
            ) : (
              <ul className="space-y-3">
                {cobrables.map((envio) => {
                  const desplegado = abierto === envio.id;
                  const bs = saldoEnBs(envio);
                  return (
                    <li key={envio.id} className="rounded-2xl border border-linea">
                      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <p className="truncate font-display text-lg font-bold text-marino-900">{nombreEnvio(envio)}</p>
                          <div className="mt-1"><InsigniaEstado estado={envio.estado} /></div>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-2xl font-bold text-marino-900">{formatearUsd(saldoPendienteCentavos(envio))}</p>
                          {bs !== null && <p className="text-sm font-semibold text-suave">≈ {formatearBs(bs)}</p>}
                        </div>
                        <button type="button" className="btn btn-primario" aria-expanded={desplegado} onClick={() => setAbierto(desplegado ? null : envio.id)}>
                          {desplegado ? <>Cerrar <FiChevronUp aria-hidden /></> : <>Pagar <FiChevronDown aria-hidden /></>}
                        </button>
                      </div>
                      {desplegado && (
                        <div className="border-t border-linea p-4">
                          <PagoCliente envio={envio} alCambiar={reemplazar} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {pagos.length > 0 && (
          <section className="tarjeta mt-6 p-5 sm:p-6" aria-labelledby="titulo-historial">
            <h2 id="titulo-historial" className="mb-4 text-xl">Historial de pagos</h2>
            <ul className="divide-y divide-linea">
              {pagos.map(({ pago, envio }) => (
                <li key={pago.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-marino-900">{nombreEnvio(envio)}</p>
                    <p className="text-suave">{formatearFecha(pago.creadoEn)} · {NOMBRE_METODO[pago.metodo] ?? pago.metodo}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatearUsd(pago.montoUsdCentavos)}</p>
                    <p className={`text-xs font-bold ${pago.estado === 'CONFIRMADO' ? 'text-verde' : pago.estado === 'RECHAZADO' ? 'text-rojo' : 'text-oro-600'}`}>
                      {pago.estado === 'CONFIRMADO' ? 'Confirmado' : pago.estado === 'RECHAZADO' ? 'Rechazado' : 'En revisión'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </ContenidoCuenta>
    </>
  );
}
