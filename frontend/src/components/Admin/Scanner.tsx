import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import imageCompression from 'browser-image-compression';
import type { Paquete } from '../../types';
import { api, ApiError } from '../../lib/api';
import { formatCOP, formatPeso } from '../../lib/format';
import { Icon } from '../ui/Icon';
import { StatusBadge } from '../ui/StatusBadge';

interface ScannerProps {
  onActualizado: () => void;
  onAbrirFicha: (paquete: Paquete) => void;
}

export function Scanner({ onActualizado, onAbrirFicha }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lectorRef = useRef<BrowserMultiFormatReader | null>(null);
  const procesandoRef = useRef(false);
  const inputFotoRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  const [escaneando, setEscaneando] = useState(false);
  const [guia, setGuia] = useState('');
  const [guiaManual, setGuiaManual] = useState('');
  const [paquete, setPaquete] = useState<Paquete | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [comprimiendo, setComprimiendo] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  const detenerCamara = useCallback(() => {
    // reset() del propio lector: corta el stream, la vista previa y el bucle de escaneo.
    lectorRef.current?.reset();
    lectorRef.current = null;
    setEscaneando(false);
  }, []);

  useEffect(() => {
    return () => {
      lectorRef.current?.reset();
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const buscarGuia = useCallback(
    async (texto: string) => {
      const normalizada = texto.trim().toUpperCase();
      if (!normalizada) {
        setError('Escribe o escanea un número de guía.');
        return;
      }

      detenerCamara();
      setGuia(normalizada);
      setBuscando(true);
      setError(null);
      setMensaje(null);
      setPaquete(null);

      try {
        const data = await api.get<{ paquete: Paquete }>(
          `/admin/paquetes/buscar?guia=${encodeURIComponent(normalizada)}`,
        );
        setPaquete(data.paquete);
        setMensaje(`Guía ${data.paquete.guia} encontrada.`);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'No pudimos consultar la guía. Intenta de nuevo.',
        );
      } finally {
        setBuscando(false);
        procesandoRef.current = false;
      }
    },
    [detenerCamara],
  );

  const iniciarCamara = async () => {
    setError(null);
    setMensaje(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite abrir la cámara. Usa la búsqueda manual.');
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    procesandoRef.current = false;

    try {
      const lector = new BrowserMultiFormatReader();
      lectorRef.current = lector;
      setEscaneando(true);

      // La promesa se resuelve cuando el bucle de decodificación inicia; el
      // frenado se hace con lector.reset() al detener la cámara.
      await lector.decodeFromVideoDevice(null, video, (result) => {
        if (result && !procesandoRef.current) {
          procesandoRef.current = true;
          void buscarGuia(result.getText());
        }
      });
    } catch {
      setEscaneando(false);
      lectorRef.current = null;
      setError(
        'No pudimos abrir la cámara. Revisa los permisos del navegador o usa la búsqueda manual.',
      );
    }
  };

  const buscarManual = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void buscarGuia(guiaManual);
  };

  const seleccionarFoto = () => {
    inputFotoRef.current?.click();
  };

  const subirFoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const archivo = event.target.files?.[0];
    if (!archivo || !paquete) return;

    setError(null);
    setMensaje(null);
    setComprimiendo(true);

    try {
      const comprimida = await imageCompression(archivo, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: 'image/jpeg',
        initialQuality: 0.82,
      });

      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      const url = URL.createObjectURL(comprimida);
      previewRef.current = url;
      setPreview(url);
      setComprimiendo(false);
      setSubiendo(true);

      const formData = new FormData();
      formData.append('foto', comprimida, `evidencia-${paquete.guia}.jpg`);

      const data = await api.upload<{ paquete: { id: string; guia: string; fotoUrl: string } }>(
        `/admin/paquetes/${paquete.id}/foto`,
        formData,
      );

      setPaquete((previo) => (previo ? { ...previo, fotoUrl: data.paquete.fotoUrl } : previo));
      setMensaje('Foto comprimida y adjuntada a la ficha del paquete.');
      onActualizado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos procesar la foto.');
    } finally {
      setComprimiendo(false);
      setSubiendo(false);
      if (event.target) event.target.value = '';
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <div className="border border-line bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="eyebrow">Lector de códigos de barras</p>
            <span className="inline-flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-muted">
              <span
                className={escaneando ? 'h-1.5 w-1.5 bg-gold' : 'h-1.5 w-1.5 bg-line'}
                aria-hidden="true"
              />
              {escaneando ? 'Cámara activa' : 'En espera'}
            </span>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden bg-navy">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              playsInline
              aria-label="Vista de la cámara para escanear guías"
            />

            {!escaneando && (
              <div className="absolute inset-0 grid place-items-center px-6 text-center">
                <div>
                  <Icon name="scan" size={34} className="mx-auto text-gold" />
                  <p className="mt-3 font-display text-lg font-bold text-paper">
                    Escanea la guía del paquete
                  </p>
                  <p className="mx-auto mt-1.5 max-w-[34ch] text-[12px] leading-relaxed text-paper/50">
                    Apunta la cámara al código de barras. La búsqueda es inmediata y no abre la
                    ficha del cliente.
                  </p>
                </div>
              </div>
            )}

            {escaneando && (
              <>
                <span className="absolute left-4 top-4 h-6 w-6 border-l-2 border-t-2 border-gold" aria-hidden="true" />
                <span className="absolute right-4 top-4 h-6 w-6 border-r-2 border-t-2 border-gold" aria-hidden="true" />
                <span className="absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2 border-gold" aria-hidden="true" />
                <span className="absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-gold" aria-hidden="true" />
                <span className="absolute inset-x-8 top-1/2 h-px bg-gold/80" aria-hidden="true" />
              </>
            )}
          </div>

          <div className="flex flex-col gap-2 p-4 sm:flex-row">
            {!escaneando ? (
              <button type="button" onClick={() => void iniciarCamara()} className="btn btn-primary flex-1">
                <Icon name="camera" size={14} />
                Activar cámara
              </button>
            ) : (
              <button type="button" onClick={detenerCamara} className="btn btn-outline flex-1">
                <Icon name="close" size={14} />
                Detener cámara
              </button>
            )}
            <p className="flex items-center font-mono text-[8px] uppercase leading-relaxed tracking-[0.08em] text-muted sm:max-w-[210px]">
              La cámara requiere HTTPS o localhost.
            </p>
          </div>
        </div>

        <form onSubmit={buscarManual} className="mt-4 border border-line bg-white p-4">
          <label htmlFor="guia-manual" className="field-label">
            Búsqueda manual de guía
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="guia-manual"
              value={guiaManual}
              onChange={(event) => setGuiaManual(event.target.value.toUpperCase())}
              className="field font-mono uppercase"
              placeholder="VEX-2026-04217"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="btn btn-outline shrink-0" disabled={buscando}>
              <Icon name="search" size={14} />
              Buscar
            </button>
          </div>
        </form>

        <div className="mt-4 border-l-2 border-gold bg-gold/[0.07] px-4 py-3">
          <p className="font-mono text-[8px] uppercase leading-relaxed tracking-[0.1em] text-ink/70">
            La foto se comprime en el navegador antes de enviarse. El servidor solo acepta imágenes
            de hasta 6 MB y las guarda con un nombre aleatorio.
          </p>
        </div>
      </div>

      <div className="lg:col-span-5">
        <div className="border border-line bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="eyebrow">Resultado</p>
            {guia && <p className="font-mono text-[9px] tracking-[0.08em] text-muted">{guia}</p>}
          </div>

          <div className="p-4">
            {buscando && (
              <div className="space-y-3">
                <div className="h-3 w-40 bg-ink/[0.07]" />
                <div className="h-8 w-52 bg-ink/[0.06]" />
                <div className="h-2.5 w-full bg-ink/[0.05]" />
                <div className="h-2.5 w-2/3 bg-ink/[0.05]" />
              </div>
            )}

            {!buscando && error && (
              <div className="flex items-start gap-2 border-l-2 border-red bg-red/[0.04] px-3 py-2.5">
                <Icon name="alert" size={15} className="mt-0.5 shrink-0 text-red" />
                <p className="text-sm leading-snug text-red">{error}</p>
              </div>
            )}

            {!buscando && mensaje && !error && paquete && (
              <div className="flex items-start gap-2 border-l-2 border-gold bg-gold/[0.08] px-3 py-2">
                <Icon name="check" size={14} className="mt-0.5 shrink-0" />
                <p className="text-[12px] leading-snug text-ink">{mensaje}</p>
              </div>
            )}

            {!buscando && !paquete && !error && (
              <div className="grid min-h-[220px] place-items-center border border-dashed border-ink/20 bg-paper/60">
                <div className="max-w-[30ch] px-4 text-center">
                  <Icon name="barcode" size={28} className="mx-auto text-line" />
                  <p className="mt-3 text-sm font-medium text-ink">Sin guía consultada.</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">
                    Escanea un código o escribe la guía para ver el paquete y adjuntar la evidencia.
                  </p>
                </div>
              </div>
            )}

            {!buscando && paquete && !error && (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[15px] tracking-tight">{paquete.guia}</p>
                    <p className="mt-1 text-[12px] text-muted">
                      {paquete.cliente?.nombre ?? 'Cliente sin nombre'}
                    </p>
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                      {paquete.cliente?.casillero ?? 'Sin casillero'}
                    </p>
                  </div>
                  <StatusBadge estado={paquete.estado} />
                </div>

                <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-muted">
                  {paquete.descripcion}
                </p>

                <dl className="mt-4 grid grid-cols-2 border-y border-line py-3">
                  <div>
                    <dt className="meta">Peso cobrable</dt>
                    <dd className="mt-0.5 font-mono text-[11px]">{formatPeso(paquete.pesoCobrable)}</dd>
                  </div>
                  <div>
                    <dt className="meta">Costo</dt>
                    <dd className="mt-0.5 font-mono text-[11px]">{formatCOP(paquete.precio)}</dd>
                  </div>
                </dl>

                <div className="mt-4">
                  <p className="meta">Evidencia fotográfica</p>
                  {preview || paquete.fotoUrl ? (
                    <img
                      src={preview ?? paquete.fotoUrl ?? ''}
                      alt={`Evidencia del paquete ${paquete.guia}`}
                      className="mt-2 h-32 w-full border border-line object-cover"
                    />
                  ) : (
                    <div className="mt-2 grid h-32 place-items-center border border-dashed border-ink/20 bg-paper">
                      <p className="font-mono text-[8px] uppercase tracking-[0.1em] text-muted">
                        Sin foto todavía
                      </p>
                    </div>
                  )}

                  <input
                    ref={inputFotoRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => void subirFoto(event)}
                  />

                  <div className="mt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={seleccionarFoto}
                      disabled={comprimiendo || subiendo}
                      className="btn btn-gold w-full disabled:opacity-60"
                    >
                      <Icon name="camera" size={14} />
                      {comprimiendo
                        ? 'Comprimiendo…'
                        : subiendo
                          ? 'Subiendo…'
                          : paquete.fotoUrl
                            ? 'Reemplazar foto'
                            : 'Tomar foto del paquete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onAbrirFicha(paquete)}
                      className="btn btn-outline w-full"
                    >
                      Abrir ficha completa
                      <Icon name="arrowUpRight" size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
