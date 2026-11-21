import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasosConsolidacion } from '../src/components/envio/Consolidado';
import DetalleEnvio from '../src/pages/DetalleEnvio';
import Escaneo from '../src/pages/panel/Escaneo';
import { AuthProvider } from '../src/lib/auth';
import type { Envio, ItemBodega, PagoVista, PaqueteVista, Rol, Usuario } from '../src/lib/tipos';

interface Llamada {
  url: string;
  metodo: string;
  cuerpo: unknown;
}

function enrutar(rutas: Record<string, unknown>, llamadas: Llamada[] = []) {
  return vi.fn(async (url: string, opciones?: RequestInit) => {
    const metodo = opciones?.method ?? 'GET';
    const cuerpo = typeof opciones?.body === 'string' ? JSON.parse(opciones.body) : null;
    llamadas.push({ url, metodo, cuerpo });
    const respuesta = rutas[`${metodo} ${url}`];
    if (respuesta === undefined) return new Response(JSON.stringify({ error: { mensaje: `Sin ruta de prueba: ${metodo} ${url}` } }), { status: 404 });
    return new Response(JSON.stringify(respuesta), { status: 200 });
  });
}

function paquete(id: string, tracking: string): PaqueteVista {
  return { id, tracking, recibido: true, pesoKg: null, valorDeclaradoCentavos: 3000, tieneFoto: false, fotoRuta: null, avisado: false, recibidoEn: '2026-11-20T10:00:00Z' };
}

function crearEnvio(sobrescribir: Partial<Envio> = {}): Envio {
  return {
    id: 'env-1',
    tipo: 'CONSOLIDADO',
    sinDueno: false,
    estado: 'POR_CONSOLIDAR',
    etiquetaEstado: 'Por consolidar',
    modalidad: 'M1',
    modalidadSugerida: null,
    transportista: 'MRW',
    tienda: 'Envío consolidado',
    valorDeclaradoCentavos: 6000,
    cliente: { id: 'cli-1', nombre: 'Ana Prueba Rojas', telefono: '573001110001', codigo: 'VENV-123456', cedulaEnmascarada: 'V-***101' },
    paquetes: [paquete('p1', 'SHN26110040'), paquete('p2', 'SHN26110041')],
    faltan: 0,
    pesoTotalKg: null,
    precio: null,
    tasa: null,
    entrega: { nombre: null, cedula: null, telefono: null, agencia: null, ciudad: null, estado: null },
    guia: { numero: null, tieneFoto: false, fotoRuta: null },
    pagos: [],
    pagadoCentavos: 0,
    creadoEn: '2026-11-20T10:00:00Z',
    actualizadoEn: '2026-11-20T10:00:00Z',
    ...sobrescribir,
  };
}

const PRECIO = { pesoCobrableKg: 4.35, precioPorKgCentavos: 950, fleteCentavos: 4133, seguroCentavos: 300, seguroManual: false, totalCentavos: 4433, totalBsCentavos: 3990000 };

function pago(estado: PagoVista['estado']): PagoVista {
  return { id: 'pago-1', estado, metodo: 'PAGO_MOVIL', moneda: 'BS', montoOriginalCentavos: 3990000, montoUsdCentavos: 4433, referencia: '123456', tieneComprobante: true, comprobanteRuta: null, motivoRechazo: null, creadoEn: '2026-11-20T11:00:00Z' };
}

function usuario(rol: Rol): Usuario {
  return { id: 'usr-1', nombre: 'Luis Operador', email: 'operador@ejemplo.com', codigo: 'VENV-000001', telefono: '573000000001', cedulaEnmascarada: 'V-***001', rol, activo: true, debeCambiarClave: false };
}

const ITEM_BODEGA: ItemBodega = {
  paqueteId: 'p3',
  tracking: 'SHN26110099',
  pesoKg: null,
  tieneFoto: false,
  fotoRuta: null,
  recibidoEn: '2026-11-20T09:00:00Z',
  envioId: 'alerta-1',
  tipoEnvio: 'ALERTA',
  estadoEnvio: 'RECIBIDO_COMPLETO',
  sinDueno: false,
  cliente: { id: 'cli-1', nombre: 'Ana Prueba Rojas', codigo: 'VENV-123456' },
};

const RUTA_BODEGA = 'GET /api/staff/bodega?q=VENV-123456';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Pantalla de consolidación: tres pasos', () => {
  it('caso feliz: muestra los pasos en orden, sin peso por paquete ni foto, y «Calcular total» al final', async () => {
    vi.stubGlobal('fetch', enrutar({ [RUTA_BODEGA]: { paquetes: [] } }));
    render(<PasosConsolidacion envio={crearEnvio()} alCambiar={vi.fn()} />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((titulo) => titulo.textContent)).toEqual(['1 · Paquetes del envío', '2 · Peso y cobro', '3 · Total y cotización']);
    expect(screen.queryByText(/Guardar peso/)).toBeNull();
    expect(screen.queryByText(/Peso del paquete/)).toBeNull();
    expect(screen.queryByText(/Foto del paquete/)).toBeNull();
    const botones = screen.getAllByRole('button');
    expect(botones[botones.length - 1]).toHaveTextContent('Calcular total');
  });

  it('caso feliz: con total calculado, la cotización por WhatsApp aparece después de recalcular', async () => {
    vi.stubGlobal('fetch', enrutar({ [RUTA_BODEGA]: { paquetes: [] } }));
    render(<PasosConsolidacion envio={crearEnvio({ estado: 'POR_PAGAR', pesoTotalKg: 4.35, precio: PRECIO })} alCambiar={vi.fn()} />);
    const botones = screen.getAllByRole('button');
    expect(botones[botones.length - 2]).toHaveTextContent('Recalcular total');
    expect(botones[botones.length - 1]).toHaveTextContent('Enviar cotización por WhatsApp');
    expect(screen.getByText(/44,33/)).toBeInTheDocument();
  });

  it('caso feliz: calcula el total con el peso escrito con coma', async () => {
    const llamadas: Llamada[] = [];
    const calculado = crearEnvio({ estado: 'POR_PAGAR', pesoTotalKg: 4.35, precio: PRECIO });
    vi.stubGlobal('fetch', enrutar({ [RUTA_BODEGA]: { paquetes: [] }, 'POST /api/staff/envios/env-1/cotizar': { envio: calculado } }, llamadas));
    const alCambiar = vi.fn();
    render(<PasosConsolidacion envio={crearEnvio()} alCambiar={alCambiar} />);
    fireEvent.change(screen.getByLabelText('Peso total del envío (kg)'), { target: { value: '4,35' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calcular total' }));
    await waitFor(() => expect(alCambiar).toHaveBeenCalledWith(calculado));
    expect(llamadas.find((llamada) => llamada.url.endsWith('/cotizar'))?.cuerpo).toEqual({ pesoKg: 4.35 });
  });

  it('caso feliz: la tecla Enter en el peso también calcula el total', async () => {
    const llamadas: Llamada[] = [];
    vi.stubGlobal('fetch', enrutar({ [RUTA_BODEGA]: { paquetes: [] }, 'POST /api/staff/envios/env-1/cotizar': { envio: crearEnvio({ precio: PRECIO }) } }, llamadas));
    render(<PasosConsolidacion envio={crearEnvio()} alCambiar={vi.fn()} />);
    const campo = screen.getByLabelText('Peso total del envío (kg)');
    fireEvent.change(campo, { target: { value: '2' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    await waitFor(() => expect(llamadas.some((llamada) => llamada.url.endsWith('/cotizar'))).toBe(true));
  });

  it('error: sin peso no llama al servidor y avisa qué falta', async () => {
    const llamadas: Llamada[] = [];
    vi.stubGlobal('fetch', enrutar({ [RUTA_BODEGA]: { paquetes: [] } }, llamadas));
    render(<PasosConsolidacion envio={crearEnvio()} alCambiar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Calcular total' }));
    expect(await screen.findByText('Escribe el peso total del envío en kg.')).toBeInTheDocument();
    expect(llamadas.some((llamada) => llamada.url.endsWith('/cotizar'))).toBe(false);
  });

  it('límite: un envío sin paquetes avisa y no deja calcular', () => {
    vi.stubGlobal('fetch', enrutar({ [RUTA_BODEGA]: { paquetes: [] } }));
    render(<PasosConsolidacion envio={crearEnvio({ paquetes: [] })} alCambiar={vi.fn()} />);
    expect(screen.getByText(/Este envío no tiene paquetes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Calcular total' })).toBeDisabled();
  });
});

describe('Pantalla de consolidación: quitar y agregar paquetes', () => {
  it('caso feliz: pide confirmar y devuelve el paquete a la bodega del cliente', async () => {
    const llamadas: Llamada[] = [];
    const sinUno = crearEnvio({ paquetes: [paquete('p2', 'SHN26110041')] });
    vi.stubGlobal('fetch', enrutar({ [RUTA_BODEGA]: { paquetes: [] }, 'POST /api/staff/envios/env-1/quitar-paquete': { envio: sinUno } }, llamadas));
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alCambiar = vi.fn();
    render(<PasosConsolidacion envio={crearEnvio()} alCambiar={alCambiar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar paquete SHN26110040' }));
    await waitFor(() => expect(alCambiar).toHaveBeenCalledWith(sinUno));
    expect(confirmar).toHaveBeenCalled();
    expect(llamadas.find((llamada) => llamada.url.endsWith('/quitar-paquete'))?.cuerpo).toEqual({ paqueteId: 'p1' });
  });

  it('límite: si el operador no confirma, no se quita nada', async () => {
    const llamadas: Llamada[] = [];
    vi.stubGlobal('fetch', enrutar({ [RUTA_BODEGA]: { paquetes: [] } }, llamadas));
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<PasosConsolidacion envio={crearEnvio()} alCambiar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar paquete SHN26110040' }));
    expect(llamadas.some((llamada) => llamada.url.endsWith('/quitar-paquete'))).toBe(false);
  });

  it('error: si el servidor rechaza quitar el paquete, el mensaje se ve en pantalla', async () => {
    vi.stubGlobal('fetch', enrutar({ [RUTA_BODEGA]: { paquetes: [] } }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<PasosConsolidacion envio={crearEnvio()} alCambiar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar paquete SHN26110040' }));
    expect(await screen.findByText(/Sin ruta de prueba/)).toBeInTheDocument();
  });

  it('caso feliz: agrega al envío los paquetes que el operador marca de la bodega del cliente', async () => {
    const llamadas: Llamada[] = [];
    const conTres = crearEnvio({ paquetes: [paquete('p1', 'SHN26110040'), paquete('p2', 'SHN26110041'), paquete('p3', 'SHN26110099')] });
    vi.stubGlobal('fetch', enrutar({ [RUTA_BODEGA]: { paquetes: [ITEM_BODEGA] }, 'POST /api/staff/envios/env-1/paquetes': { envio: conTres } }, llamadas));
    const alCambiar = vi.fn();
    render(<PasosConsolidacion envio={crearEnvio()} alCambiar={alCambiar} />);
    const boton = await screen.findByRole('button', { name: 'Elige paquetes para agregar' });
    expect(boton).toBeDisabled();
    fireEvent.click(screen.getByLabelText('SHN26110099'));
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar 1 paquete(s) al envío' }));
    await waitFor(() => expect(alCambiar).toHaveBeenCalledWith(conTres));
    expect(llamadas.find((llamada) => llamada.url.endsWith('/paquetes'))?.cuerpo).toEqual({ paqueteIds: ['p3'] });
  });
});

function pantallaEnvio(envio: Envio, rol: Rol, personal = true) {
  const rutas: Record<string, unknown> = {
    'GET /api/auth/yo': { usuario: usuario(rol) },
    'GET /api/envios/env-1': { envio },
    [RUTA_BODEGA]: { paquetes: [] },
  };
  vi.stubGlobal('fetch', enrutar(rutas));
  const ruta = personal ? '/panel/envios/env-1' : '/cuenta/envios/env-1';
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <AuthProvider>
        <Routes>
          <Route path={personal ? '/panel/envios/:id' : '/cuenta/envios/:id'} element={<DetalleEnvio personal={personal} />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function titulos(): string[] {
  return screen.getAllByRole('heading', { level: 2 }).map((titulo) => titulo.textContent ?? '');
}

describe('Pantalla del envío: solo lo de la etapa', () => {
  const CORRECCION = 'Corregir peso, valor o total (solo administrador)';

  it('caso feliz: consolidando muestra solo los tres pasos, sin pagos, entrega ni despacho', async () => {
    pantallaEnvio(crearEnvio(), 'OPERADOR');
    expect(await screen.findByRole('heading', { name: '1 · Paquetes del envío' })).toBeInTheDocument();
    expect(titulos()).toEqual(['Cliente', '1 · Paquetes del envío', '2 · Peso y cobro', '3 · Total y cotización']);
    expect(screen.queryByText(CORRECCION)).toBeNull();
  });

  it('caso feliz: revisando el pago muestra los pagos y deja los paquetes plegados', async () => {
    pantallaEnvio(crearEnvio({ estado: 'POR_CONFIRMAR', precio: PRECIO, pesoTotalKg: 4.35, pagos: [pago('POR_CONFIRMAR')] }), 'OPERADOR');
    expect(await screen.findByRole('heading', { name: 'Pagos' })).toBeInTheDocument();
    expect(screen.getByText('Ver los 2 paquete(s) del envío')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '1 · Paquetes del envío' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Despacho' })).toBeNull();
  });

  it('caso feliz: el administrador ve la corrección solo cuando ya hay un pago registrado', async () => {
    pantallaEnvio(crearEnvio({ estado: 'POR_CONFIRMAR', precio: PRECIO, pesoTotalKg: 4.35, pagos: [pago('POR_CONFIRMAR')] }), 'ADMIN');
    expect(await screen.findByText(CORRECCION)).toBeInTheDocument();
  });

  it('error: el operador no ve nunca la corrección del administrador', async () => {
    pantallaEnvio(crearEnvio({ estado: 'POR_CONFIRMAR', precio: PRECIO, pesoTotalKg: 4.35, pagos: [pago('POR_CONFIRMAR')] }), 'OPERADOR');
    await screen.findByRole('heading', { name: 'Pagos' });
    expect(screen.queryByText(CORRECCION)).toBeNull();
  });

  it('límite: el administrador tampoco la ve antes del pago', async () => {
    pantallaEnvio(crearEnvio({ estado: 'POR_PAGAR', precio: PRECIO, pesoTotalKg: 4.35 }), 'ADMIN');
    await screen.findByRole('heading', { name: '1 · Paquetes del envío' });
    expect(screen.queryByText(CORRECCION)).toBeNull();
  });

  it('caso feliz: enviando a Venezuela muestra el despacho y los datos de entrega, no los pasos de consolidar', async () => {
    pantallaEnvio(crearEnvio({ estado: 'PAGADO', precio: PRECIO, pesoTotalKg: 4.35, pagos: [pago('CONFIRMADO')], pagadoCentavos: 4433 }), 'OPERADOR');
    expect(await screen.findByRole('heading', { name: 'Despacho' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Datos de entrega en Venezuela' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '2 · Peso y cobro' })).toBeNull();
  });

  it('límite: un envío descartado sigue mostrando sus paquetes al personal', async () => {
    pantallaEnvio(crearEnvio({ estado: 'CANCELADO' }), 'OPERADOR');
    expect(await screen.findByText('Ver los 2 paquete(s) del envío')).toBeInTheDocument();
  });

  it('caso feliz: el cliente conserva su pantalla con paquetes y modalidad, sin los pasos del operador', async () => {
    pantallaEnvio(crearEnvio(), 'CLIENTE', false);
    expect(await screen.findByRole('heading', { name: 'Modalidad de cobro' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Paquetes' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '1 · Paquetes del envío' })).toBeNull();
    expect(within(screen.getByRole('heading', { name: 'Paquetes' }).closest('section')!).queryByText(/Quitar paquete/)).toBeNull();
  });
});

describe('Escaneo: foto del paquete en la pantalla de recepción', () => {
  it('caso feliz: tras recibir un paquete ofrece tomar la foto y ya no pide el peso', async () => {
    const recibido = { resultado: 'RECIBIDO', envioId: 'env-1', paqueteId: 'p1', cliente: 'Ana Prueba Rojas', sinDueno: false, faltan: 0, texto: 'SHN26110040' };
    vi.stubGlobal('fetch', enrutar({ 'POST /api/staff/escaneo': recibido }));
    render(
      <MemoryRouter>
        <Escaneo />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('O escríbelo a mano'), { target: { value: 'SHN26110040' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect(await screen.findByText(/Recibido: Ana Prueba Rojas/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tomar foto del paquete \(opcional\)/ })).toBeInTheDocument();
    expect(screen.queryByText(/Peso del paquete/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Guardar peso' })).toBeNull();
  });

  it('error: si el código no tiene prealerta no ofrece la foto', async () => {
    vi.stubGlobal('fetch', enrutar({ 'POST /api/staff/escaneo': { resultado: 'SIN_PREALERTA', texto: 'XYZ123456' } }));
    render(
      <MemoryRouter>
        <Escaneo />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('O escríbelo a mano'), { target: { value: 'XYZ123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    await screen.findByText(/Nadie tiene una alerta/);
    expect(screen.queryByRole('button', { name: /Tomar foto del paquete/ })).toBeNull();
  });
});
