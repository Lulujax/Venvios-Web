import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { FiCamera, FiCameraOff, FiImage } from 'react-icons/fi';
import { crearLectorDelNavegador, type LectorCodigos } from '../lib/lectorCodigos';
import { crearRegistro } from '../lib/registro';
import { Alerta } from './ui';

const registro = crearRegistro('escaner');

const INTERVALO_LECTURA_MS = 200;
const MAXIMO_BYTES_FOTO = 15 * 1024 * 1024;
export const MENSAJE_SIN_CODIGO = 'No encontramos un código en la foto. Acércate más, que se vea nítido y sin reflejos, o escribe el número a mano.';
export const MENSAJE_FOTO_PESADA = 'La foto pesa más de 15 MB. Toma otra más liviana.';
export const MENSAJE_NO_IMAGEN = 'Ese archivo no es una imagen. Elige una foto de la etiqueta.';
export const MENSAJE_FALLO_FOTO = 'No pudimos leer la foto. Intenta con otra o escribe el número a mano.';

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

export function validarFoto(archivo: { type: string; size: number }): string | null {
  if (!archivo.type.startsWith('image/')) return MENSAJE_NO_IMAGEN;
  if (archivo.size > MAXIMO_BYTES_FOTO) return MENSAJE_FOTO_PESADA;
  return null;
}

async function pedirEnfoqueContinuo(flujo: MediaStream): Promise<void> {
  const pista = flujo.getVideoTracks()[0];
  const capacidades = pista?.getCapabilities?.() as (MediaTrackCapabilities & { focusMode?: string[] }) | undefined;
  if (!pista || !capacidades?.focusMode?.includes('continuous')) return;
  try {
    await pista.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] });
    registro.info('Enfoque continuo activado');
  } catch (falla) {
    registro.warn('No se pudo activar el enfoque continuo', { motivo: falla instanceof Error ? falla.message : 'desconocido' });
  }
}

interface EscanerProps {
  onLeido: (texto: string) => void;
  pausado?: boolean;
  obtenerLector?: () => Promise<LectorCodigos>;
}

export function Escaner({ onLeido, pausado = false, obtenerLector = crearLectorDelNavegador }: EscanerProps) {
  const video = useRef<HTMLVideoElement>(null);
  const entradaFoto = useRef<HTMLInputElement>(null);
  const ultimo = useRef<{ texto: string; hora: number } | null>(null);
  const alLeer = useRef(onLeido);
  const pedirLector = useRef(obtenerLector);
  const pausadoRef = useRef(pausado);
  const [activo, setActivo] = useState(false);
  const [leyendoFoto, setLeyendoFoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [motor, setMotor] = useState<string | null>(null);

  useEffect(() => {
    alLeer.current = onLeido;
  }, [onLeido]);

  useEffect(() => {
    pedirLector.current = obtenerLector;
  }, [obtenerLector]);

  useEffect(() => {
    pausadoRef.current = pausado;
  }, [pausado]);

  const entregarDeCamara = useCallback((texto: string): void => {
    const ahora = Date.now();
    if (!aceptarLectura(ultimo.current, texto, ahora)) return;
    ultimo.current = { texto, hora: ahora };
    navigator.vibrate?.(60);
    registro.info('Código leído con la cámara', { largo: texto.length });
    alLeer.current(texto);
  }, []);

  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    let leyendo = false;
    let temporizador: number | undefined;
    let flujo: MediaStream | null = null;

    const detener = (): void => {
      if (temporizador !== undefined) window.clearInterval(temporizador);
      flujo?.getTracks().forEach((pista) => pista.stop());
      flujo = null;
      if (video.current) video.current.srcObject = null;
    };

    const iniciar = async (): Promise<void> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(describirErrorCamara(null));
        setActivo(false);
        return;
      }
      registro.info('Encendiendo la cámara');
      try {
        const promesaLector = pedirLector.current();
        promesaLector.catch(() => undefined);
        flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
        const lector = await promesaLector;
        if (!vivo || !video.current) {
          detener();
          return;
        }
        await pedirEnfoqueContinuo(flujo);
        video.current.srcObject = flujo;
        await video.current.play();
        const medidas = flujo.getVideoTracks()[0]?.getSettings();
        registro.info('Cámara encendida', { ancho: medidas?.width, alto: medidas?.height, motor: lector.nombre });
        setMotor(`${lector.nombre}${medidas?.width ? ` · ${medidas.width}x${medidas.height}` : ''}`);
        temporizador = window.setInterval(() => {
          const elemento = video.current;
          if (leyendo || pausadoRef.current || !elemento || elemento.videoWidth === 0) return;
          leyendo = true;
          lector
            .leerCuadro(elemento)
            .then((textos) => {
              if (vivo && textos[0]) entregarDeCamara(textos[0]);
            })
            .catch((falla) => registro.warn('No se pudo leer el cuadro', { motivo: falla instanceof Error ? falla.message : 'desconocido' }))
            .finally(() => {
              leyendo = false;
            });
        }, INTERVALO_LECTURA_MS);
      } catch (falla) {
        detener();
        if (!vivo) return;
        registro.error('No se pudo abrir la cámara', { nombre: falla instanceof Error ? falla.name : 'desconocido' });
        setError(describirErrorCamara(falla));
        setActivo(false);
      }
    };

    void iniciar();
    return () => {
      vivo = false;
      registro.info('Apagando la cámara');
      detener();
    };
  }, [activo, entregarDeCamara]);

  async function alElegirFoto(evento: ChangeEvent<HTMLInputElement>): Promise<void> {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo) return;
    const problema = validarFoto(archivo);
    if (problema) {
      registro.warn('Foto rechazada', { tipo: archivo.type, bytes: archivo.size });
      setError(problema);
      return;
    }
    setError(null);
    setLeyendoFoto(true);
    registro.info('Leyendo foto', { bytes: archivo.size });
    try {
      const lector = await pedirLector.current();
      const textos = await lector.leerImagen(archivo);
      if (!textos[0]) {
        registro.warn('La foto no tiene un código legible');
        setError(MENSAJE_SIN_CODIGO);
        return;
      }
      navigator.vibrate?.(60);
      registro.info('Código leído en la foto', { largo: textos[0].length, codigos: textos.length });
      alLeer.current(textos[0]);
    } catch (falla) {
      registro.error('Falló la lectura de la foto', { motivo: falla instanceof Error ? falla.message : 'desconocido' });
      setError(MENSAJE_FALLO_FOTO);
    } finally {
      setLeyendoFoto(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-tarjeta bg-marino-900">
        <video ref={video} className={`h-full w-full object-cover ${activo ? '' : 'hidden'}`} muted playsInline aria-label="Vista de la cámara" />
        {!activo && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
            <div>
              <FiCamera className="mx-auto mb-3 text-5xl text-oro" aria-hidden />
              <p className="font-display text-xl font-bold">Escanea el QR o el código de barras</p>
              <p className="mt-1 text-sm text-white/70">Apunta al código de la etiqueta del paquete, o toma una foto.</p>
            </div>
          </div>
        )}
        {activo && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square h-3/4 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-oro/90 shadow-[0_0_0_9999px_rgba(12,26,74,0.35)]" aria-hidden>
            <span className="absolute inset-x-3 top-1/2 h-0.5 animate-pulso bg-rojo" />
          </div>
        )}
      </div>
      {import.meta.env.DEV && activo && motor && <p className="ayuda">Lector: {motor}</p>}
      {error && <Alerta tono="aviso">{error}</Alerta>}
      <button type="button" className={`btn w-full ${activo ? 'btn-suave' : 'btn-primario'}`} onClick={() => { setError(null); setActivo((v) => !v); }}>
        {activo ? <><FiCameraOff aria-hidden /> Apagar cámara</> : <><FiCamera aria-hidden /> Encender cámara</>}
      </button>
      <input ref={entradaFoto} type="file" accept="image/*" className="hidden" aria-label="Elegir foto de la etiqueta" onChange={(evento) => void alElegirFoto(evento)} />
      <button type="button" className="btn btn-suave w-full" disabled={leyendoFoto} onClick={() => entradaFoto.current?.click()}>
        <FiImage aria-hidden /> {leyendoFoto ? 'Leyendo la foto…' : 'Tomar o subir foto'}
      </button>
    </div>
  );
}
