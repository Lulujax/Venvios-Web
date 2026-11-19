import { describe, expect, it } from 'vitest';
import { construirEnlacesWhatsApp, renderizarPlantilla } from '../src/domain/whatsapp';

describe('enlaces de WhatsApp', () => {
  it('caso feliz: arma el enlace móvil y el de WhatsApp Web con el texto codificado', () => {
    const enlaces = construirEnlacesWhatsApp('+57 300 123 4567', 'Hola & gracias');
    expect(enlaces.movil).toBe('https://wa.me/573001234567?text=Hola%20%26%20gracias');
    expect(enlaces.web).toContain('web.whatsapp.com/send?phone=573001234567&text=');
  });

  it('error: teléfono inválido o texto vacío', () => {
    expect(() => construirEnlacesWhatsApp('123', 'hola')).toThrow('teléfono');
    expect(() => construirEnlacesWhatsApp('573001234567', '  ')).toThrow('vacío');
  });
});

describe('plantillas', () => {
  it('reemplaza variables y quita las líneas que quedan vacías', () => {
    const texto = renderizarPlantilla('Hola {nombre}\n{nota}\nAdiós', { nombre: 'Luis', nota: '' });
    expect(texto).toBe('Hola Luis\nAdiós');
  });

  it('límite: variable desconocida se vuelve vacía dentro de una línea con texto', () => {
    expect(renderizarPlantilla('Guía: {guia}', {})).toBe('Guía:');
  });

  it('error: plantilla vacía', () => {
    expect(() => renderizarPlantilla('', {})).toThrow();
  });
});
