import { useState } from 'react';
import { FiCheck, FiX } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { Alerta, Campo, ImagenPrivada, Seleccion, useAviso } from '../ui';
import { api, mensajeDeError } from '../../lib/api';
import { aNumero, formatearBs, formatearFecha, formatearUsd, nombreEnvio, NOMBRE_METODO } from '../../lib/formato';
import type { Envio, PagoVista } from '../../lib/tipos';
import { validarMonto } from '../../lib/validar';
import { enviarPorWhatsApp, pedirMensaje } from '../../lib/whatsapp';

const TONO_PAGO: Record<PagoVista['estado'], string> = {
  POR_CONFIRMAR: 'bg-oro-100 text-marino-900',
  CONFIRMADO: 'bg-verde-100 text-verde',
  RECHAZADO: 'bg-rojo-100 text-rojo-700',
};
const TEXTO_PAGO: Record<PagoVista['estado'], string> = { POR_CONFIRMAR: 'Por confirmar', CONFIRMADO: 'Confirmado', RECHAZADO: 'Rechazado' };

export function ListaPagos({ pagos }: { pagos: PagoVista[] }) {
  if (pagos.length === 0) return <p className="text-sm text-suave">Aún no hay pagos registrados.</p>;
  return (
    <ul className="space-y-2">
      {pagos.map((pago) => (
        <li key={pago.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-linea px-4 py-3 text-sm">
          <div>
            <p className="font-bold">{formatearUsd(pago.montoUsdCentavos)} <span className="font-normal text-suave">· {NOMBRE_METODO[pago.metodo] ?? pago.metodo}{pago.moneda === 'BS' ? ` (${formatearBs(pago.montoOriginalCentavos)})` : ''}</span></p>
            <p className="text-suave">{formatearFecha(pago.creadoEn)}{pago.referencia ? ` · Ref. ${pago.referencia}` : ''}</p>
            {pago.motivoRechazo && <p className="font-semibold text-rojo-700">Motivo: {pago.motivoRechazo}</p>}
          </div>
          <span className={`insignia ${TONO_PAGO[pago.estado]}`}>{TEXTO_PAGO[pago.estado]}</span>
        </li>
      ))}
    </ul>
  );
}

export function PagosPersonal({ envio, alCambiar }: { envio: Envio; alCambiar: (envio: Envio) => void }) {
  const avisar = useAviso();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState({ metodo: 'MANUAL', moneda: 'USD', monto: '', referencia: '' });
  const [errorMonto, setErrorMonto] = useState<string | undefined>();

  async function ejecutar(clave: string, tarea: () => Promise<void>) {
    setOcupado(clave);
    setError(null);
    try {
      await tarea();
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setOcupado(null);
    }
  }

  const confirmar = (pagoId: string) =>
    ejecutar(pagoId, async () => {
      const r = await api.post<{ envio: Envio }>(`/staff/pagos/${pagoId}/confirmar`);
      alCambiar(r.envio);
      avisar(r.envio.estado === 'PAGADO' ? 'Pago confirmado. El envío quedó «Enviando a Venezuela».' : 'Pago parcial confirmado. Aún falta saldo.');
      if (r.envio.estado === 'PAGADO') {
        try {
          const mensaje = await pedirMensaje(envio.id, 'pagoVerificado');
          await enviarPorWhatsApp(mensaje, null);
        } catch {
          avisar('Pago confirmado, pero no pudimos preparar el WhatsApp.', 'aviso');
        }
      }
    });

  const rechazar = (pagoId: string) =>
    ejecutar(pagoId, async () => {
      if (motivo.trim().length < 3) throw new Error('Escribe el motivo del rechazo.');
      const r = await api.post<{ envio: Envio }>(`/staff/pagos/${pagoId}/rechazar`, { motivo });
      alCambiar(r.envio);
      const mensaje = await pedirMensaje(envio.id, 'pagoRechazado', { motivo });
      await enviarPorWhatsApp(mensaje, null);
      setRechazando(null);
      setMotivo('');
      avisar('Pago rechazado. Se abrió WhatsApp con el motivo.');
    });

  const registrarManual = () =>
    ejecutar('manual', async () => {
      const fallo = validarMonto(manual.monto);
      setErrorMonto(fallo ?? undefined);
      if (fallo) return;
      const r = await api.post<{ envio: Envio }>(`/staff/envios/${envio.id}/pago-manual`, { ...manual, monto: aNumero(manual.monto) });
      alCambiar(r.envio);
      setManual({ metodo: 'MANUAL', moneda: 'USD', monto: '', referencia: '' });
      avisar('Pago registrado.');
    });

  const puedeCobrar = envio.precio !== null && ['RECIBIDO_COMPLETO', 'POR_CONFIRMAR'].includes(envio.estado);

  return (
    <div className="space-y-4">
      {error && <Alerta tono="error">{error}</Alerta>}
      {envio.pagos.length === 0 && <p className="text-sm text-suave">Aún no hay pagos registrados.</p>}
      <ul className="space-y-3">
        {envio.pagos.map((pago) => (
          <li key={pago.id} className="rounded-2xl border border-linea p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="text-sm">
                <p className="text-lg font-bold">{formatearUsd(pago.montoUsdCentavos)} <span className="text-base font-normal text-suave">· {NOMBRE_METODO[pago.metodo] ?? pago.metodo}</span></p>
                {pago.moneda === 'BS' && <p className="text-suave">Pagó {formatearBs(pago.montoOriginalCentavos)}</p>}
                <p className="text-suave">{formatearFecha(pago.creadoEn)}{pago.referencia ? ` · Ref. ${pago.referencia}` : ''}</p>
                {pago.motivoRechazo && <p className="font-semibold text-rojo-700">Motivo: {pago.motivoRechazo}</p>}
              </div>
              <span className={`insignia ${TONO_PAGO[pago.estado]}`}>{TEXTO_PAGO[pago.estado]}</span>
            </div>
            {pago.tieneComprobante && <ImagenPrivada ruta={pago.comprobanteRuta} alt="Comprobante de pago" className="mt-3 max-h-80 w-full object-contain bg-papel sm:w-auto" tipo="comprobante" referencia={`${nombreEnvio(envio)} ${pago.referencia ?? ''}`} conBotonDescarga />}
            {pago.estado === 'POR_CONFIRMAR' && (
              <div className="mt-4 space-y-3">
                {rechazando === pago.id ? (
                  <div className="space-y-3 rounded-2xl bg-rojo-100/60 p-3">
                    <Campo etiqueta="Motivo del rechazo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. No aparece el depósito" />
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-peligro btn-chico" disabled={ocupado === pago.id} onClick={() => void rechazar(pago.id)}><FaWhatsapp aria-hidden /> Rechazar y avisar</button>
                      <button type="button" className="btn btn-suave btn-chico" onClick={() => setRechazando(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-primario btn-chico" disabled={ocupado === pago.id} onClick={() => void confirmar(pago.id)}><FiCheck aria-hidden /> Confirmar pago</button>
                    <button type="button" className="btn btn-suave btn-chico" onClick={() => setRechazando(pago.id)}><FiX aria-hidden /> Rechazar</button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {puedeCobrar && (
        <details className="rounded-2xl border border-linea bg-papel p-4">
          <summary className="cursor-pointer text-sm font-bold text-marino">Registrar un pago recibido en oficina</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Seleccion etiqueta="Método" value={manual.metodo} onChange={(e) => setManual({ ...manual, metodo: e.target.value })} opciones={[{ valor: 'MANUAL', texto: 'Efectivo / oficina' }, { valor: 'BINANCE', texto: 'Binance' }, { valor: 'PAGO_MOVIL', texto: 'Pago móvil' }, { valor: 'TRANSFERENCIA', texto: 'Transferencia' }]} />
            <Seleccion etiqueta="Moneda" value={manual.moneda} onChange={(e) => setManual({ ...manual, moneda: e.target.value })} opciones={[{ valor: 'USD', texto: 'Dólares' }, { valor: 'BS', texto: 'Bolívares' }]} />
            <Campo etiqueta="Monto" inputMode="decimal" value={manual.monto} onChange={(e) => setManual({ ...manual, monto: e.target.value })} error={errorMonto} />
            <Campo etiqueta="Referencia (opcional)" value={manual.referencia} onChange={(e) => setManual({ ...manual, referencia: e.target.value })} />
          </div>
          <button type="button" className="btn btn-primario btn-chico mt-4" disabled={ocupado === 'manual'} onClick={() => void registrarManual()}>Registrar y confirmar</button>
        </details>
      )}
    </div>
  );
}
