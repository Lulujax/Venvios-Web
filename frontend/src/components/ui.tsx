import { createContext, useCallback, useContext, useEffect, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiInbox, FiInfo } from 'react-icons/fi';
import { ETIQUETAS_ESTADO, TONO_ESTADO } from '../lib/formato';
import { urlArchivo } from '../lib/api';
import type { EstadoEnvio } from '../lib/tipos';

export function Marca({ claro = false, tamano = 'normal' }: { claro?: boolean; tamano?: 'normal' | 'grande' }) {
  const alto = tamano === 'grande' ? 'h-14' : 'h-10';
  return (
    <span className="inline-flex items-center gap-2.5">
      <img src="/marca.png" alt="" className={`${alto} w-auto`} width={48} height={40} />
      <span className={`font-display leading-none ${tamano === 'grande' ? 'text-3xl' : 'text-xl'} ${claro ? 'text-white' : 'text-marino-900'}`}>
        <span className="text-oro-600">V</span>envios <span className="text-rojo">E</span>xpress
      </span>
    </span>
  );
}

export function InsigniaEstado({ estado }: { estado: EstadoEnvio }) {
  return <span className={`insignia ${TONO_ESTADO[estado]}`}>{ETIQUETAS_ESTADO[estado]}</span>;
}

type Tono = 'info' | 'error' | 'ok' | 'aviso';

const TONOS: Record<Tono, { caja: string; icono: ReactNode }> = {
  info: { caja: 'border-marino/20 bg-marino-50 text-marino-900', icono: <FiInfo aria-hidden /> },
  error: { caja: 'border-rojo/30 bg-rojo-100 text-rojo-700', icono: <FiAlertTriangle aria-hidden /> },
  ok: { caja: 'border-verde/30 bg-verde-100 text-verde', icono: <FiCheckCircle aria-hidden /> },
  aviso: { caja: 'border-oro/50 bg-oro-50 text-marino-900', icono: <FiAlertTriangle aria-hidden /> },
};

export function Alerta({ tono = 'info', children, className = '' }: { tono?: Tono; children: ReactNode; className?: string }) {
  const { caja, icono } = TONOS[tono];
  return (
    <div role={tono === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-medium ${caja} ${className}`}>
      <span className="mt-0.5 text-lg">{icono}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Cargando({ lineas = 3 }: { lineas?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: lineas }, (_, indice) => (
        <div key={indice} className="h-16 animate-pulso rounded-2xl bg-linea/60" />
      ))}
    </div>
  );
}

export function Vacio({ titulo, texto, accion }: { titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className="rounded-tarjeta border border-dashed border-linea bg-white/60 px-6 py-12 text-center">
      <FiInbox className="mx-auto mb-3 text-4xl text-marino/40" aria-hidden />
      <p className="font-display text-xl font-bold text-marino-900">{titulo}</p>
      {texto && <p className="mx-auto mt-1 max-w-sm text-sm text-suave">{texto}</p>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  );
}

export function ErrorCarga({ mensaje, reintentar }: { mensaje: string; reintentar?: () => void }) {
  return (
    <Alerta tono="error">
      <p>{mensaje}</p>
      {reintentar && (
        <button type="button" className="btn btn-suave btn-chico mt-3" onClick={reintentar}>
          Reintentar
        </button>
      )}
    </Alerta>
  );
}

interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  ayuda?: string;
  error?: string | null;
}

export function Campo({ etiqueta, ayuda, error, id, className = '', ...resto }: CampoProps) {
  const identificador = id ?? `campo-${etiqueta.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <div className={className}>
      <label htmlFor={identificador} className="etiqueta">
        {etiqueta}
      </label>
      <input id={identificador} className={`campo ${error ? 'border-rojo focus:ring-rojo/20' : ''}`} aria-invalid={Boolean(error)} aria-describedby={ayuda || error ? `${identificador}-nota` : undefined} {...resto} />
      {(ayuda || error) && (
        <p id={`${identificador}-nota`} className={`ayuda ${error ? 'font-semibold text-rojo' : ''}`}>
          {error ?? ayuda}
        </p>
      )}
    </div>
  );
}

interface SeleccionProps extends SelectHTMLAttributes<HTMLSelectElement> {
  etiqueta: string;
  opciones: Array<{ valor: string; texto: string }>;
}

export function Seleccion({ etiqueta, opciones, id, className = '', ...resto }: SeleccionProps) {
  const identificador = id ?? `sel-${etiqueta.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <div className={className}>
      <label htmlFor={identificador} className="etiqueta">
        {etiqueta}
      </label>
      <select id={identificador} className="campo" {...resto}>
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ImagenPrivada({ ruta, alt, className = '' }: { ruta: string | null; alt: string; className?: string }) {
  const [fallo, setFallo] = useState(false);
  const url = urlArchivo(ruta);
  if (!url || fallo) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      <img src={url} alt={alt} loading="lazy" onError={() => setFallo(true)} className={`rounded-2xl border border-linea object-cover ${className}`} />
    </a>
  );
}

export function Seccion({ titulo, derecha, children, className = '' }: { titulo: string; derecha?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`tarjeta p-5 sm:p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl">{titulo}</h2>
        {derecha}
      </div>
      {children}
    </section>
  );
}

interface AvisoToast {
  id: number;
  texto: string;
  tono: Tono;
}

const ContextoAvisos = createContext<(texto: string, tono?: Tono) => void>(() => undefined);

export function useAviso(): (texto: string, tono?: Tono) => void {
  return useContext(ContextoAvisos);
}

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<AvisoToast[]>([]);

  const avisar = useCallback((texto: string, tono: Tono = 'ok') => {
    const id = Date.now() + Math.random();
    setAvisos((actuales) => [...actuales.slice(-2), { id, texto, tono }]);
  }, []);

  useEffect(() => {
    if (avisos.length === 0) return;
    const temporizador = setTimeout(() => setAvisos((actuales) => actuales.slice(1)), 4500);
    return () => clearTimeout(temporizador);
  }, [avisos]);

  return (
    <ContextoAvisos.Provider value={avisar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {avisos.map((aviso) => (
          <div key={aviso.id} className="pointer-events-auto max-w-md animate-entrar">
            <Alerta tono={aviso.tono} className="bg-white shadow-elevada">
              {aviso.texto}
            </Alerta>
          </div>
        ))}
      </div>
    </ContextoAvisos.Provider>
  );
}
