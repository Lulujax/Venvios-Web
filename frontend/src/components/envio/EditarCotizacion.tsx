import { useState } from 'react';
import { Alerta, Campo, useAviso } from '../ui';
import { api, mensajeDeError } from '../../lib/api';
import { aNumero, formatearUsd } from '../../lib/formato';
import type { Envio, PaqueteVista } from '../../lib/tipos';

const MIN_MOTIVO = 5;

interface PropiedadesEnvio {
  envio: Envio;
  alCambiar: (envio: Envio) => void;
}

export function EditarValorPaquete({ paquete, alCambiar }: { paquete: PaqueteVista; alCambiar: (envio: Envio) => void }) {
  const avisar = useAviso();
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState((paquete.valorDeclaradoCentavos / 100).toFixed(2));
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const valorUsd = aNumero(valor);
    if (!Number.isFinite(valorUsd) || valorUsd < 0) return setError('Escribe el valor en dólares (0 si no se sabe).');
    if (motivo.trim().length < MIN_MOTIVO) return setError(`Escribe el motivo del cambio (mínimo ${MIN_MOTIVO} letras).`);
    setGuardando(true);
    setError(null);
    try {
      const r = await api.patch<{ envio: Envio }>(`/staff/paquetes/${paquete.id}/valor`, { valorUsd, motivo });
      alCambiar(r.envio);
      setAbierto(false);
      setMotivo('');
      avisar('Valor cambiado. El total se recalculó.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-suave">Valor: <b className="text-tinta">{formatearUsd(paquete.valorDeclaradoCentavos)}</b></span>
        <button type="button" className="btn btn-suave btn-chico" aria-label={`Editar valor del paquete ${paquete.tracking}`} onClick={() => setAbierto(true)}>Editar valor</button>
      </div>
    );
  }
  return (
    <div className="mt-2 w-full space-y-3 rounded-2xl bg-papel p-3">
      <Campo etiqueta={`Valor del paquete ${paquete.tracking} ($)`} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
      <Campo etiqueta="Motivo del cambio" value={motivo} onChange={(e) => setMotivo(e.target.value)} ayuda="Por ejemplo: la factura dice otro monto." />
      {error && <Alerta tono="error">{error}</Alerta>}
      <div className="flex gap-2">
        <button type="button" className="btn btn-primario btn-chico" disabled={guardando} onClick={() => void guardar()}>{guardando ? 'Guardando…' : 'Guardar valor'}</button>
        <button type="button" className="btn btn-suave btn-chico" onClick={() => { setAbierto(false); setError(null); }}>Cancelar</button>
      </div>
    </div>
  );
}

export function EditarSeguro({ envio, alCambiar }: PropiedadesEnvio) {
  const avisar = useAviso();
  const [abierto, setAbierto] = useState(false);
  const [seguro, setSeguro] = useState(((envio.precio?.seguroCentavos ?? 0) / 100).toFixed(2));
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  if (!envio.precio) return null;

  async function enviar(cuerpo: { seguroUsd: number | null; motivo: string }, aviso: string) {
    setGuardando(true);
    setError(null);
    try {
      const r = await api.patch<{ envio: Envio }>(`/staff/envios/${envio.id}/seguro`, cuerpo);
      alCambiar(r.envio);
      setAbierto(false);
      setMotivo('');
      avisar(aviso);
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setGuardando(false);
    }
  }

  function guardar() {
    const seguroUsd = aNumero(seguro);
    if (!Number.isFinite(seguroUsd) || seguroUsd < 0) return setError('Escribe el seguro en dólares (0 si no lleva).');
    if (motivo.trim().length < MIN_MOTIVO) return setError(`Escribe el motivo del cambio (mínimo ${MIN_MOTIVO} letras).`);
    void enviar({ seguroUsd, motivo }, 'Seguro cambiado. El total se recalculó.');
  }

  return (
    <div className="mt-4 rounded-2xl border border-linea p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>Seguro de carga: <b>{formatearUsd(envio.precio.seguroCentavos)}</b> <span className="text-suave">({envio.precio.seguroManual ? 'editado a mano' : 'automático'})</span></p>
        <div className="flex gap-2">
          {!abierto && <button type="button" className="btn btn-suave btn-chico" onClick={() => setAbierto(true)}>Editar seguro</button>}
          {envio.precio.seguroManual && !abierto && (
            <button type="button" className="btn btn-suave btn-chico" disabled={guardando} onClick={() => void enviar({ seguroUsd: null, motivo: '' }, 'Seguro vuelto a automático.')}>Volver a automático</button>
          )}
        </div>
      </div>
      {abierto && (
        <div className="mt-3 space-y-3">
          <Campo etiqueta="Seguro de carga ($)" inputMode="decimal" value={seguro} onChange={(e) => setSeguro(e.target.value)} />
          <Campo etiqueta="Motivo del cambio" value={motivo} onChange={(e) => setMotivo(e.target.value)} ayuda="Por ejemplo: descuento acordado con el cliente." />
          {error && <Alerta tono="error">{error}</Alerta>}
          <div className="flex gap-2">
            <button type="button" className="btn btn-primario btn-chico" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar seguro'}</button>
            <button type="button" className="btn btn-suave btn-chico" onClick={() => { setAbierto(false); setError(null); }}>Cancelar</button>
          </div>
        </div>
      )}
      {!abierto && error && <Alerta tono="error" className="mt-3">{error}</Alerta>}
    </div>
  );
}
