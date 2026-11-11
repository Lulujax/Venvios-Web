import { useState, type ChangeEvent, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/api';
import { Icon } from '../ui/Icon';
import type { Prealerta } from '../../types';

interface FormState {
  tienda: string;
  descripcion: string;
  trackingTienda: string;
  valorDeclarado: string;
}

const INICIAL: FormState = {
  tienda: '',
  descripcion: '',
  trackingTienda: '',
  valorDeclarado: '',
};

export function PrealertaForm({ onCreada }: { onCreada: () => void }) {
  const [form, setForm] = useState<FormState>(INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [erroresCampo, setErroresCampo] = useState<Record<string, string>>({});
  const [exito, setExito] = useState<string | null>(null);

  const onChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((previo) => ({ ...previo, [name]: value }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEnviando(true);
    setError(null);
    setExito(null);
    setErroresCampo({});

    try {
      await api.post<{ prealerta: Prealerta }>('/prealertas', {
        tienda: form.tienda,
        descripcion: form.descripcion,
        trackingTienda: form.trackingTienda || undefined,
        valorDeclarado: form.valorDeclarado ? Number(form.valorDeclarado) : undefined,
      });
      setForm(INICIAL);
      setExito('Prealerta registrada. Te avisaremos por WhatsApp cuando llegue a Cúcuta.');
      onCreada();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setErroresCampo(err.erroresPorCampo);
      } else {
        setError('No pudimos registrar la prealerta. Intenta de nuevo.');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section id="nueva-prealerta" className="scroll-mt-24 border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="eyebrow">§ 01 / Aviso de paquete</p>
          <h2 className="mt-1 font-display text-lg font-bold tracking-tight">Nueva prealerta</h2>
        </div>
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
          Avisa antes de comprar
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4 p-4 sm:grid-cols-2" noValidate>
        {error && (
          <div className="flex items-start gap-3 border-l-2 border-red bg-red/[0.04] px-3 py-2.5 sm:col-span-2">
            <Icon name="alert" size={15} className="mt-0.5 shrink-0 text-red" />
            <p className="text-sm leading-snug text-red">{error}</p>
          </div>
        )}

        {exito && (
          <div className="flex items-start gap-3 border-l-2 border-gold bg-gold/[0.08] px-3 py-2.5 sm:col-span-2">
            <Icon name="check" size={15} className="mt-0.5 shrink-0 text-ink" />
            <p className="text-sm leading-snug text-ink">{exito}</p>
          </div>
        )}

        <div>
          <label htmlFor="tienda" className="field-label">
            Tienda o remitente
          </label>
          <input
            id="tienda"
            name="tienda"
            value={form.tienda}
            onChange={onChange}
            required
            maxLength={80}
            className="field"
            placeholder="Falabella Colombia"
          />
          {erroresCampo.tienda && <p className="field-error">{erroresCampo.tienda}</p>}
        </div>

        <div>
          <label htmlFor="trackingTienda" className="field-label">
            Guía de la tienda <span className="normal-case text-muted/70">(opcional)</span>
          </label>
          <input
            id="trackingTienda"
            name="trackingTienda"
            value={form.trackingTienda}
            onChange={onChange}
            maxLength={60}
            className="field font-mono"
            placeholder="FLB-889231"
          />
          {erroresCampo.trackingTienda && (
            <p className="field-error">{erroresCampo.trackingTienda}</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="descripcion" className="field-label">
            ¿Qué viene en el paquete?
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            value={form.descripcion}
            onChange={onChange}
            required
            maxLength={200}
            rows={2}
            className="field resize-none"
            placeholder="Zapatos talla 38 y dos camisetas"
          />
          {erroresCampo.descripcion && <p className="field-error">{erroresCampo.descripcion}</p>}
        </div>

        <div>
          <label htmlFor="valorDeclarado" className="field-label">
            Valor declarado COP <span className="normal-case text-muted/70">(opcional)</span>
          </label>
          <input
            id="valorDeclarado"
            name="valorDeclarado"
            type="number"
            min={0}
            step={1000}
            value={form.valorDeclarado}
            onChange={onChange}
            className="field font-mono"
            placeholder="289000"
          />
          {erroresCampo.valorDeclarado && (
            <p className="field-error">{erroresCampo.valorDeclarado}</p>
          )}
        </div>

        <div className="flex items-end">
          <button type="submit" disabled={enviando} className="btn btn-primary w-full disabled:opacity-60">
            {enviando ? 'Registrando…' : 'Registrar prealerta'}
            {!enviando && <Icon name="arrowRight" size={14} />}
          </button>
        </div>
      </form>
    </section>
  );
}
