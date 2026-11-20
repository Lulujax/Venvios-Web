import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FaWhatsapp } from 'react-icons/fa';
import type { IconType } from 'react-icons';
import { FiArrowRight } from 'react-icons/fi';
import { api } from '../lib/api';
import type { Envio, InfoPublica } from '../lib/tipos';
import { useCarga } from '../lib/useCarga';

export function useEnviosCliente() {
  return useCarga(() => api.get<{ envios: Envio[] }>('/envios').then((respuesta) => respuesta.envios));
}

export function EncabezadoCuenta({ titulo, subtitulo, derecha }: { titulo: string; subtitulo?: ReactNode; derecha?: ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-marino-900 text-white">
      <div className="cinta-diagonal absolute inset-0" aria-hidden />
      <div className="relative mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 pb-14 pt-8 sm:px-6 lg:px-10 lg:pb-16">
        <div className="min-w-0">
          <h1 className="text-3xl text-white sm:text-4xl">{titulo}</h1>
          {subtitulo && <div className="mt-2 text-white/80">{subtitulo}</div>}
        </div>
        {derecha}
      </div>
    </div>
  );
}

export function ContenidoCuenta({ children }: { children: ReactNode }) {
  return <div className="relative mx-auto -mt-8 max-w-6xl px-4 pb-10 sm:px-6 lg:px-10">{children}</div>;
}

interface TarjetaCifraProps {
  titulo: string;
  valor: string;
  detalle?: ReactNode;
  icono: IconType;
  a: string;
  enlace: string;
}

export function TarjetaCifra({ titulo, valor, detalle, icono: Icono, a, enlace }: TarjetaCifraProps) {
  return (
    <div className="tarjeta flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm font-bold text-suave">{titulo}</p>
          <p className="mt-1 font-display text-3xl font-bold text-marino-900">{valor}</p>
          {detalle && <div className="mt-2 text-sm text-suave">{detalle}</div>}
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-marino-50 text-xl text-marino"><Icono aria-hidden /></span>
      </div>
      <Link to={a} className="mt-auto flex items-center justify-between border-t border-linea bg-papel/60 px-5 py-3 text-sm font-bold text-marino hover:bg-marino-50">
        {enlace} <FiArrowRight aria-hidden />
      </Link>
    </div>
  );
}

export function BotonWhatsAppFlotante() {
  const { datos } = useCarga(() => api.get<InfoPublica>('/publico/info'));
  if (!datos) return null;
  const enlace = `https://wa.me/${datos.contacto.whatsapp}?text=${encodeURIComponent('Hola Venvios Express, necesito ayuda con mi casillero.')}`;
  return (
    <a
      href={enlace}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribir por WhatsApp a Venvios Express"
      className="fixed bottom-24 right-4 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-[#25D366] px-5 text-base font-bold text-white shadow-elevada transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marino lg:bottom-6 lg:right-6"
    >
      <FaWhatsapp className="text-2xl" aria-hidden />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
