import { BrowserMultiFormatReader, DecodeHintType } from '@zxing/library';
import { useEffect, useRef, useState } from 'react';
import { FiCamera, FiCameraOff } from 'react-icons/fi';
import { Alerta } from './ui';

export function describirErrorCamara(error: unknown): string {
  const nombre = error instanceof Error ? error.name : '';
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'La cámara solo funciona en una página segura (con candado). Escribe el número a mano.';
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') return 'No diste permiso a la cámara. Actívalo en los ajustes del navegador o escribe el número a mano.';
  if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') return 'Este dispositivo no tiene una cámara disponible. Escribe el número a mano.';
  if (nombre === 'NotReadableError') return 'La cámara está en uso por otra aplicación. Ciérrala e intenta de nuevo.';
  return 'No pudimos abrir la cámara. Escribe el número a mano.';
}

export function aceptarLectura(ultimo: { texto: string; hora: number } | null, texto: string, ahora: number, ventanaMs = 2500): boolean {
  if (!texto.trim()) return false;
  if (ultimo && ultimo.texto === texto && ahora - ultimo.hora < ventanaMs) return false;
  return true;
}

interface EscanerProps {
  onLeido: (texto: string) => void;
  pausado?: boolean;
}

export function Escaner({ onLeido, pausado = false }: EscanerProps) {
  const video = useRef<HTMLVideoElement>(null);
  const ultimo = useRef<{ texto: string; hora: number } | null>(null);
  const alLeer = useRef(onLeido);
  const [activo, setActivo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    alLeer.current = onLeido;
  }, [onLeido]);

  useEffect(() => {
    if (!activo || pausado || !video.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(describirErrorCamara(null));
      setActivo(false);
      return;
    }
    const pistas = new Map();
    pistas.set(DecodeHintType.TRY_HARDER, true);
    const lector = new BrowserMultiFormatReader(pistas, 250);
    let vivo = true;
    lector
      .decodeFromConstraints({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } }, video.current, (resultado) => {
        if (!vivo || !resultado) return;
        const texto = resultado.getText().trim();
        const ahora = Date.now();
        if (!aceptarLectura(ultimo.current, texto, ahora)) return;
        ultimo.current = { texto, hora: ahora };
        navigator.vibrate?.(60);
        alLeer.current(texto);
      })
      .catch((falla) => {
        if (!vivo) return;
        setError(describirErrorCamara(falla));
        setActivo(false);
      });
    return () => {
      vivo = false;
      lector.reset();
    };
  }, [activo, pausado]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-tarjeta bg-marino-900">
        <video ref={video} className={`h-full w-full object-cover ${activo ? '' : 'hidden'}`} muted playsInline aria-label="Vista de la cámara" />
        {!activo && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
            <div>
              <FiCamera className="mx-auto mb-3 text-5xl text-oro" aria-hidden />
              <p className="font-display text-xl font-bold">Escanea el código de barras</p>
              <p className="mt-1 text-sm text-white/70">Apunta al código de la etiqueta del paquete.</p>
            </div>
          </div>
        )}
        {activo && (
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-2xl border-2 border-oro/90 shadow-[0_0_0_9999px_rgba(12,26,74,0.35)]" aria-hidden>
            <span className="absolute inset-x-3 top-1/2 h-0.5 animate-pulso bg-rojo" />
          </div>
        )}
      </div>
      {error && <Alerta tono="aviso">{error}</Alerta>}
      <button type="button" className={`btn w-full ${activo ? 'btn-suave' : 'btn-primario'}`} onClick={() => { setError(null); setActivo((v) => !v); }}>
        {activo ? <><FiCameraOff aria-hidden /> Apagar cámara</> : <><FiCamera aria-hidden /> Encender cámara</>}
      </button>
    </div>
  );
}
