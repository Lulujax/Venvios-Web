import { dolaresABolivaresCentavos } from '../domain/dinero';
import { calcularPrecio, kilosACentesimas, modalidadPropuesta, type Modalidad, type PrecioCalculado } from '../domain/tarifas';
import { validarPesoKg, validarValorDeclarado } from '../domain/validaciones';
import type { ConfigService } from './ConfigService';
import type { TasaService } from './TasaService';

export interface CotizacionPublica {
  pesoKg: number;
  modalidadSugerida: Modalidad;
  opciones: Array<PrecioCalculado & { totalBsCentavos: number | null; cobroADestino: boolean }>;
  tasa: { bolivaresPorUsd: number; fecha: string; desactualizada: boolean } | null;
}

export class PublicoService {
  constructor(
    private readonly config: ConfigService,
    private readonly tasas: TasaService,
  ) {}

  async informacion() {
    const tasa = await this.tasaOpcional();
    return {
      tarifas: await this.config.tarifas(),
      transportistas: (await this.config.transportistas()).map((t) => ({ codigo: t.codigo, nombre: t.nombre, urlRastreo: t.urlRastreo, parametroGuia: t.parametroGuia })),
      contacto: await this.config.contacto(),
      tasa,
    };
  }

  private async tasaOpcional() {
    try {
      const tasa = await this.tasas.vigente();
      return { bolivaresPorUsd: tasa.bolivaresPorUsd, fecha: tasa.fecha, desactualizada: tasa.desactualizada };
    } catch {
      return null;
    }
  }

  async cotizar(pesoKg: number, valorDeclaradoUsd: number): Promise<CotizacionPublica> {
    const peso = validarPesoKg(pesoKg);
    const valor = validarValorDeclarado(valorDeclaradoUsd);
    const centesimas = kilosACentesimas(peso);
    const tarifas = await this.config.tarifas();
    const tasa = await this.tasaOpcional();
    const modalidades: Modalidad[] = ['M2', 'M1'];
    return {
      pesoKg: peso,
      modalidadSugerida: modalidadPropuesta(centesimas),
      opciones: modalidades.map((modalidad) => {
        const precio = calcularPrecio(modalidad, centesimas, valor, tarifas);
        return {
          ...precio,
          totalBsCentavos: tasa ? dolaresABolivaresCentavos(precio.totalCentavos, tasa.bolivaresPorUsd) : null,
          cobroADestino: modalidad === 'M2',
        };
      }),
      tasa,
    };
  }
}
