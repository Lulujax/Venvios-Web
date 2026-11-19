import { api, urlArchivo } from './api';
import { aPng } from './imagenes';
import type { MensajeWhatsApp } from './tipos';

export type ResultadoEnvio = 'compartido' | 'foto-copiada' | 'abierto';

export function esDispositivoTactil(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && window.matchMedia?.('(pointer: coarse)').matches !== false;
}

async function descargarFoto(ruta: string): Promise<Blob> {
  const url = urlArchivo(ruta);
  if (!url) throw new Error('No hay foto para adjuntar.');
  const respuesta = await fetch(url, { credentials: 'same-origin' });
  if (!respuesta.ok) throw new Error('No pudimos cargar la foto.');
  return respuesta.blob();
}

export async function copiarFotoAlPortapapeles(ruta: string): Promise<boolean> {
  try {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') return false;
    const png = await aPng(await descargarFoto(ruta));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return true;
  } catch {
    return false;
  }
}

export async function compartirFoto(ruta: string, texto: string): Promise<boolean> {
  try {
    const blob = await descargarFoto(ruta);
    const archivo = new File([blob], 'foto.jpg', { type: blob.type || 'image/jpeg' });
    if (!navigator.canShare?.({ files: [archivo] })) return false;
    await navigator.share({ files: [archivo], text: texto });
    return true;
  } catch {
    return false;
  }
}

export async function enviarPorWhatsApp(mensaje: MensajeWhatsApp, fotoRuta: string | null): Promise<ResultadoEnvio> {
  const tactil = esDispositivoTactil();
  if (fotoRuta && tactil && (await compartirFoto(fotoRuta, mensaje.texto))) return 'compartido';
  let fotoCopiada = false;
  if (fotoRuta && !tactil) fotoCopiada = await copiarFotoAlPortapapeles(fotoRuta);
  window.open(tactil ? mensaje.movil : mensaje.web, '_blank', 'noopener');
  return fotoCopiada ? 'foto-copiada' : 'abierto';
}

export function pedirMensaje(envioId: string, tipo: string, extra: Record<string, string | undefined> = {}): Promise<MensajeWhatsApp> {
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries(extra)) if (valor) parametros.set(clave, valor);
  const consulta = parametros.toString();
  return api.get<MensajeWhatsApp>(`/staff/envios/${envioId}/mensaje/${tipo}${consulta ? `?${consulta}` : ''}`);
}

export function enlaceRastreo(urlBase: string, parametro: string | null, guia: string): string {
  if (!parametro) return urlBase;
  const separador = urlBase.includes('?') ? '&' : '?';
  return `${urlBase}${separador}${parametro}=${encodeURIComponent(guia)}`;
}
