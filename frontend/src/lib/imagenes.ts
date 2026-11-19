import imageCompression from 'browser-image-compression';

export const OPCIONES_COMPRESION = {
  maxSizeMB: 0.35,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
  initialQuality: 0.8,
} as const;

export async function comprimirImagen(archivo: File): Promise<File> {
  if (!archivo.type.startsWith('image/')) throw new Error('Elige una imagen (foto o captura).');
  if (archivo.size === 0) throw new Error('La imagen está vacía.');
  try {
    const comprimida = await imageCompression(archivo, OPCIONES_COMPRESION);
    return new File([comprimida], archivo.name.replace(/\.\w+$/, '') + '.jpg', { type: comprimida.type || 'image/jpeg' });
  } catch {
    if (archivo.size <= 3 * 1024 * 1024) return archivo;
    throw new Error('No pudimos reducir la imagen. Prueba con otra foto.');
  }
}

export async function aPng(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob;
  const bitmap = await createImageBitmap(blob);
  const lienzo = document.createElement('canvas');
  lienzo.width = bitmap.width;
  lienzo.height = bitmap.height;
  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('El navegador no pudo preparar la imagen.');
  contexto.drawImage(bitmap, 0, 0);
  return new Promise((resolver, rechazar) => {
    lienzo.toBlob((resultado) => (resultado ? resolver(resultado) : rechazar(new Error('No se pudo convertir la imagen.'))), 'image/png');
  });
}
