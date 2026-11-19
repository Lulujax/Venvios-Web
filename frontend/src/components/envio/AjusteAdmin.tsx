import { useState } from 'react';
import { Alerta, Campo, useAviso } from '../ui';
import { api, mensajeDeError } from '../../lib/api';
import { aNumero } from '../../lib/formato';
import type { Envio } from '../../lib/tipos';

export function AjusteAdmin({ envio, alCambiar }: { envio: Envio; alCambiar: (envio: Envio) => void }) {
  const avisar = useAviso();
  const [peso, setPeso] = useState('');
  const [valor, setValor] = useState('');
  const [total, setTotal] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function aplicar() {
    const cuerpo: Record<string, number | string> = { motivo };
    if (peso.trim()) cuerpo.pesoTotalKg = aNumero(peso);
    if (valor.trim()) cuerpo.valorDeclaradoUsd = aNumero(valor);
    if (total.trim()) cuerpo.totalUsd = aNumero(total);
    if (Object.keys(cuerpo).length === 1) return setError('Cambia al menos un dato.');
    if (motivo.trim().length < 5) return setError('Escribe el motivo del ajuste (mínimo 5 letras).');
    setGuardando(true);
    setError(null);
    try {
      const r = await api.post<{ envio: Envio }>(`/admin/envios/${envio.id}/ajuste`, cuerpo);
      alCambiar(r.envio);
      setPeso('');
      setValor('');
      setTotal('');
      setMotivo('');
      avisar('Ajuste aplicado y registrado en el historial.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <details className="rounded-2xl border border-oro/60 bg-oro-50 p-4">
      <summary className="cursor-pointer text-sm font-bold text-marino-900">Corregir peso, valor o total (solo administrador)</summary>
      <div className="mt-4 space-y-4">
        <p className="text-sm text-suave">Deja vacío lo que no cambia. Todo ajuste queda guardado con el valor anterior, tu usuario y el motivo.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Peso total (kg)" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder={envio.pesoTotalKg?.toFixed(2)} />
          <Campo etiqueta="Valor declarado ($)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={(envio.valorDeclaradoCentavos / 100).toFixed(2)} />
          <Campo etiqueta="Total a cobrar ($)" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder={envio.precio ? (envio.precio.totalCentavos / 100).toFixed(2) : ''} />
        </div>
        <Campo etiqueta="Motivo del ajuste" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Error de pesaje, descuento autorizado" />
        {error && <Alerta tono="error">{error}</Alerta>}
        <button type="button" className="btn btn-primario btn-chico" disabled={guardando} onClick={() => void aplicar()}>{guardando ? 'Aplicando…' : 'Aplicar ajuste'}</button>
      </div>
    </details>
  );
}
