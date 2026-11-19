import { formatearBs, formatearKg, formatearUsd, NOMBRE_MODALIDAD, nombreTransportista } from '../../lib/formato';
import type { Envio } from '../../lib/tipos';

export function PrecioCaja({ envio }: { envio: Envio }) {
  const { precio, tasa } = envio;
  if (!precio) {
    return <p className="rounded-2xl border border-dashed border-linea p-4 text-sm text-suave">El total se calcula cuando pesemos todos tus paquetes.</p>;
  }
  const saldo = Math.max(precio.totalCentavos - envio.pagadoCentavos, 0);
  return (
    <div className="rounded-2xl bg-marino-900 p-5 text-white">
      <p className="text-sm text-white/70">{NOMBRE_MODALIDAD[envio.modalidad]}</p>
      <p className="mt-1 font-display text-4xl font-bold text-oro">{formatearUsd(precio.totalCentavos)}</p>
      {precio.totalBsCentavos !== null && <p className="text-sm font-semibold text-white/80">≈ {formatearBs(precio.totalBsCentavos)}{tasa?.desactualizada ? ' (tasa de otro día)' : ''}</p>}
      <dl className="mt-4 space-y-1.5 border-t border-white/15 pt-4 text-sm">
        <div className="flex justify-between"><dt className="text-white/70">Peso cobrado</dt><dd className="font-bold">{formatearKg(precio.pesoCobrableKg)}</dd></div>
        <div className="flex justify-between"><dt className="text-white/70">Flete</dt><dd className="font-bold">{formatearUsd(precio.fleteCentavos)}</dd></div>
        <div className="flex justify-between"><dt className="text-white/70">Seguro de carga</dt><dd className="font-bold">{formatearUsd(precio.seguroCentavos)}</dd></div>
        {envio.pagadoCentavos > 0 && <div className="flex justify-between"><dt className="text-white/70">Ya pagado</dt><dd className="font-bold text-oro">{formatearUsd(envio.pagadoCentavos)}</dd></div>}
        {envio.pagadoCentavos > 0 && <div className="flex justify-between"><dt className="text-white/70">Saldo</dt><dd className="font-bold">{formatearUsd(saldo)}</dd></div>}
      </dl>
      {envio.modalidad === 'M2' && <p className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold">El tramo en Venezuela lo pagas a {nombreTransportista(envio.transportista)} al recibir (cobro a destino).</p>}
    </div>
  );
}
