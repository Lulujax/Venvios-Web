import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Paquete, Prealerta } from '../../types';
import { api, ApiError } from '../../lib/api';
import { Icon } from '../ui/Icon';
import { PrealertaBadge } from '../ui/StatusBadge';

interface ReceptionModalProps {
  abierto: boolean;
  prealerta: Prealerta | null;
  onCerrar: () => void;
  onCreado: (paquete: Paquete) => void;
}

interface FormState {
  descripcion: string;
  pesoKg: string;
  largoCm: string;
  anchoCm: string;
  altoCm: string;
  observaciones: string;
}

interface ClienteVerificado {
  id: string;
  nombre: string;
  casillero: string | null;
}

const VACIO: FormState = {
  descripcion: '',
  pesoKg: '',
  largoCm: '',
  anchoCm: '',
  altoCm: '',
  observaciones: '',
};

export function ReceptionModal({ abierto, prealerta, onCerrar, onCreado }: ReceptionModalProps) {
  const [form, setForm] = useState<FormState>(VACIO);
  const [codigo, setCodigo] = useState('');
  const [cliente, setCliente] = useState<ClienteVerificado | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [erroresCampo, setErroresCampo] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!abierto) return;
    setForm({ ...VACIO, descripcion: prealerta?.descripcion ?? '' });
    setCodigo('');
    setCliente(null);
    setError(null);
    setErroresCampo({});
    setEnviando(false);
  }, [abierto, prealerta]);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  const onChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((previo) => ({ ...previo, [name]: value }));
  };

  const verificarCasillero = async () => {
    const normalizado = codigo.trim().toUpperCase();
    if (!normalizado) {
      setError('Escribe el código de casillero del cliente.');
      return;
    }
    setVerificando(true);
    setError(null);
    try {
      const data = await api.get<{ cliente: ClienteVerificado }>(
        `/admin/clientes/buscar?codigo=${encodeURIComponent(normalizado)}`,
      );
      setCliente(data.cliente);
      setCodigo(normalizado);
    } catch (err) {
      setCliente(null);
      setError(err instanceof ApiError ? err.message : 'No pudimos verificar el casillero.');
    } finally {
      setVerificando(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setErroresCampo({});

    const dimensiones = [form.largoCm, form.anchoCm, form.altoCm];
    const conDimensiones = dimensiones.every((valor) => valor.trim() !== '');
    const algunaDimension = dimensiones.some((valor) => valor.trim() !== '');

    if (algunaDimension && !conDimensiones) {
      setError('Completa largo, ancho y alto, o deja las tres casillas vacías.');
      return;
    }

    if (!prealerta && !cliente) {
      setError('Verifica el casillero del cliente antes de registrar el paquete.');
      return;
    }

    setEnviando(true);
    try {
      const payload: Record<string, unknown> = {
        descripcion: form.descripcion,
        pesoKg: Number(form.pesoKg),
        observaciones: form.observaciones || undefined,
      };

      if (prealerta) {
        payload.prealertaId = prealerta.id;
      } else {
        payload.casilleroCodigo = codigo.trim().toUpperCase();
      }

      if (conDimensiones) {
        payload.largoCm = Number(form.largoCm);
        payload.anchoCm = Number(form.anchoCm);
        payload.altoCm = Number(form.altoCm);
      }

      const data = await api.post<{ paquete: Paquete }>('/admin/paquetes', payload);
      onCreado(data.paquete);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setErroresCampo(err.erroresPorCampo);
      } else {
        setError('No pudimos registrar el paquete. Intenta de nuevo.');
      }
    } finally {
      setEnviando(false);
    }
  };

  const clienteMostrado = prealerta?.cliente ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/50 p-4 py-8 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recepcion-titulo"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-[560px] border border-ink/25 bg-paper"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line bg-white px-5 py-4">
          <div>
            <p className="meta">Sede Cúcuta · Barrio Latino</p>
            <h2 id="recepcion-titulo" className="mt-1 font-display text-xl font-bold tracking-tight">
              Registrar recepción
            </h2>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="grid h-9 w-9 shrink-0 place-items-center border border-line hover:border-ink"
            aria-label="Cerrar registro de recepción"
          >
            <Icon name="close" size={17} />
          </button>
        </header>

        <form onSubmit={onSubmit} className="p-5" noValidate>
          {prealerta ? (
            <div className="mb-5 border border-navy/20 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
                <p className="eyebrow">Prealerta vinculada</p>
                <PrealertaBadge estado={prealerta.estado} />
              </div>
              <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
                <div>
                  <p className="meta">Cliente</p>
                  <p className="mt-0.5 text-sm font-medium">{clienteMostrado?.nombre ?? '—'}</p>
                </div>
                <div>
                  <p className="meta">Casillero</p>
                  <p className="mt-0.5 font-mono text-[11px]">{clienteMostrado?.casillero ?? '—'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="meta">Tienda</p>
                  <p className="mt-0.5 text-sm">{prealerta.tienda}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-5 border border-line bg-white p-4">
              <label htmlFor="casillero" className="field-label">
                Casillero del cliente
              </label>
              <div className="flex gap-2">
                <input
                  id="casillero"
                  value={codigo}
                  onChange={(event) => {
                    setCodigo(event.target.value.toUpperCase());
                    setCliente(null);
                  }}
                  className="field font-mono uppercase"
                  placeholder="VEX-CUC-4827"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => void verificarCasillero()}
                  disabled={verificando}
                  className="btn btn-outline shrink-0 disabled:opacity-60"
                >
                  {verificando ? 'Verificando…' : 'Verificar'}
                </button>
              </div>
              {cliente ? (
                <div className="mt-3 flex items-center justify-between gap-3 border-l-2 border-gold bg-gold/[0.08] px-3 py-2">
                  <p className="text-sm font-medium">{cliente.nombre}</p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                    {cliente.casillero}
                  </p>
                </div>
              ) : (
                <p className="mt-2 font-mono text-[8px] uppercase leading-relaxed tracking-[0.08em] text-muted">
                  El cliente debe existir y estar activo. No se muestran teléfonos.
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-start gap-2 border-l-2 border-red bg-red/[0.04] px-3 py-2.5">
              <Icon name="alert" size={15} className="mt-0.5 shrink-0 text-red" />
              <p className="text-sm leading-snug text-red">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="descripcion" className="field-label">
                Descripción de la carga
              </label>
              <input
                id="descripcion"
                name="descripcion"
                value={form.descripcion}
                onChange={onChange}
                required
                maxLength={200}
                className="field"
                placeholder="Caja mediana · calzado"
              />
              {erroresCampo.descripcion && <p className="field-error">{erroresCampo.descripcion}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="pesoKg" className="field-label">
                  Peso real (kg)
                </label>
                <input
                  id="pesoKg"
                  name="pesoKg"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.pesoKg}
                  onChange={onChange}
                  required
                  className="field font-mono"
                  placeholder="4.60"
                />
                {erroresCampo.pesoKg && <p className="field-error">{erroresCampo.pesoKg}</p>}
              </div>
              <div className="flex items-end">
                <p className="border border-line bg-white px-3 py-3 font-mono text-[8px] uppercase leading-relaxed tracking-[0.08em] text-muted">
                  El costo se calcula en el servidor con la tabla única vigente.
                </p>
              </div>
            </div>

            <fieldset>
              <legend className="field-label">Dimensiones en cm (opcional)</legend>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { name: 'largoCm', placeholder: 'Largo' },
                  { name: 'anchoCm', placeholder: 'Ancho' },
                  { name: 'altoCm', placeholder: 'Alto' },
                ].map((campo) => (
                  <div key={campo.name}>
                    <label htmlFor={campo.name} className="sr-only">
                      {campo.placeholder}
                    </label>
                    <input
                      id={campo.name}
                      name={campo.name}
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={form[campo.name as keyof FormState]}
                      onChange={onChange}
                      className="field font-mono"
                      placeholder={campo.placeholder}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.08em] text-muted">
                Peso volumétrico: L × A × H ÷ 5000
              </p>
            </fieldset>

            <div>
              <label htmlFor="observaciones" className="field-label">
                Observaciones (opcional)
              </label>
              <textarea
                id="observaciones"
                name="observaciones"
                value={form.observaciones}
                onChange={onChange}
                rows={2}
                maxLength={500}
                className="field resize-none"
                placeholder="Empaque reforzado, frágil, pago pendiente…"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCerrar} className="btn btn-ghost">
              Cancelar
            </button>
            <button type="submit" disabled={enviando} className="btn btn-primary disabled:opacity-60">
              {enviando ? 'Registrando…' : 'Registrar y notificar'}
              {!enviando && <Icon name="arrowRight" size={14} />}
            </button>
          </div>
          <p className="mt-3 font-mono text-[8px] uppercase leading-relaxed tracking-[0.08em] text-muted">
            Al registrar, se genera la guía, se calcula el costo y se envía el aviso de WhatsApp al
            cliente.
          </p>
        </form>
      </div>
    </div>
  );
}
