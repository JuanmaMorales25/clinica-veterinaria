import { CurrencyPipe, DatePipe, formatDate } from '@angular/common';
import { Component, LOCALE_ID, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ErrorApi, leerErrorApi } from '../../../core/api/error-api';
import { Aviso } from '../../../compartido/aviso/aviso';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { EstadoEtiqueta } from '../../../compartido/estado-etiqueta/estado-etiqueta';
import { TarjetaPaciente } from '../../../compartido/tarjeta-paciente/tarjeta-paciente';
import { FacturacionService } from '../facturacion.service';
import { CuentaDeCobro, DetalleConflicto, LineaCuenta } from '../modelos';

/** Lote vencido (D1) o existencia insuficiente (D2) sobre una línea de la cuenta. */
interface Conflicto {
  tipo: 'LOTE_VENCIDO' | 'EXISTENCIA_INSUFICIENTE';
  lineaId: string;
  mensaje: string;
  loteId: string | null;
  loteCodigo: string | null;
  loteVence: string | null;
  cantidad: number;
  disponible: number;
  sugerido: { id: string; codigo: string } | null;
}

/** M3.1 Cuenta de cobro, con los bloqueos por lote vencido (D1) y existencia insuficiente (D2). */
@Component({
  selector: 'cv-cuenta-cobro',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    Aviso,
    Encabezado,
    EstadoEtiqueta,
    TarjetaPaciente,
  ],
  template: `
    <cv-encabezado
      titulo="Facturación"
      [conAtras]="conflicto() !== null"
      [rutaAtras]="rutaRegistro()"
    />
    <main class="contenido">
      @if (cuenta(); as cuenta) {
        <cv-tarjeta-paciente
          [paciente]="cuenta.paciente"
          variante="compacta"
          [subtitulo]="subtitulo()"
        />

        @if (conflicto(); as conflicto) {
          @if (conflicto.tipo === 'LOTE_VENCIDO') {
            <cv-aviso tipo="alerta" titulo="Lote vencido bloqueado">
              <p>{{ conflicto.mensaje }}</p>
            </cv-aviso>
          } @else {
            <cv-aviso tipo="advertencia" titulo="Existencia insuficiente">
              <p>{{ conflicto.mensaje }}</p>
            </cv-aviso>
          }
        } @else {
          <h2 class="titulo-pagina">Cuenta de cobro</h2>
        }

        <div class="tabla-contenedor">
          <table class="tabla">
            <caption class="solo-lectores">
              Servicios y productos de la atención
            </caption>
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">Lote</th>
                <th scope="col">Vence</th>
                <th scope="col">Cant.</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (linea of cuenta.lineas; track linea.id) {
                @let enConflicto = conflicto()?.lineaId === linea.id;
                <tr
                  [class.tabla__fila--alerta]="enConflicto && conflicto()?.tipo === 'LOTE_VENCIDO'"
                  [class.tabla__fila--advertencia]="
                    enConflicto && conflicto()?.tipo === 'EXISTENCIA_INSUFICIENTE'
                  "
                >
                  <td>
                    {{ linea.descripcion }}{{ linea.tipo === 'SERVICIO' ? ' (servicio)' : '' }}
                  </td>
                  @if (linea.tipo === 'SERVICIO') {
                    <td>—</td>
                    <td>—</td>
                    <td>{{ linea.cantidad }}</td>
                    <td>Servicio</td>
                  } @else if (enConflicto) {
                    <td>{{ conflicto()?.loteCodigo ?? '—' }}</td>
                    <td>
                      {{
                        conflicto()?.loteVence ? (conflicto()?.loteVence | date: 'dd/MM/yyyy') : '—'
                      }}
                    </td>
                    <td>{{ conflicto()?.cantidad }}</td>
                    <td>
                      @if (conflicto()?.tipo === 'LOTE_VENCIDO') {
                        <cv-estado-etiqueta tipo="alerta" tamano="pequeno">
                          VENCIDO — no dispensable
                        </cv-estado-etiqueta>
                      } @else {
                        <cv-estado-etiqueta tipo="advertencia" tamano="pequeno">
                          Insuficiente: {{ conflicto()?.disponible }} de {{ conflicto()?.cantidad }}
                        </cv-estado-etiqueta>
                      }
                    </td>
                  } @else {
                    <td>
                      @if (linea.editable && !conflicto()) {
                        <label class="solo-lectores" [for]="'lote-' + linea.id">
                          Lote de {{ linea.descripcion }}
                        </label>
                        <select
                          class="selector"
                          [id]="'lote-' + linea.id"
                          [disabled]="ajustando()"
                          [ngModel]="linea.lote_id"
                          (ngModelChange)="ajustar(linea, { lote_id: $event })"
                        >
                          @for (lote of linea.lotes; track lote.id) {
                            <option [value]="lote.id">
                              {{ lote.codigo }}{{ lote.vencido ? ' (vencido)' : '' }}
                            </option>
                          }
                        </select>
                      } @else {
                        {{ linea.lote_codigo ?? '—' }}
                      }
                    </td>
                    <td>{{ linea.lote_vence ? (linea.lote_vence | date: 'dd/MM/yyyy') : '—' }}</td>
                    <td>
                      @if (linea.editable && !conflicto()) {
                        <label class="solo-lectores" [for]="'cantidad-' + linea.id">
                          Cantidad de {{ linea.descripcion }}
                        </label>
                        <select
                          class="selector"
                          [id]="'cantidad-' + linea.id"
                          [disabled]="ajustando()"
                          [ngModel]="linea.cantidad"
                          (ngModelChange)="ajustar(linea, { cantidad: +$event })"
                        >
                          @for (numero of cantidades(linea); track numero) {
                            <option [ngValue]="numero">{{ numero }}</option>
                          }
                        </select>
                      } @else {
                        {{ linea.cantidad }}
                      }
                    </td>
                    <td>
                      <cv-estado-etiqueta tipo="exito" tamano="pequeno">Vigente</cv-estado-etiqueta>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (!conflicto()) {
          <div class="total">
            <p class="total__valor">
              Total: {{ cuenta.total | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
            </p>
            <p class="texto-suave total__nota">
              Incluye los servicios prestados y los productos aplicados en la atención.
            </p>
          </div>
        }

        @if (entradaAbierta() && conflicto(); as conflicto) {
          <form class="tarjeta" (ngSubmit)="registrarEntrada(conflicto)">
            <h3 class="tarjeta__titulo">Entrada de inventario</h3>
            <div class="fila-campos">
              <div class="campo">
                <label for="unidades"
                  >Unidades que ingresan al lote {{ conflicto.loteCodigo }}</label
                >
                <input
                  id="unidades"
                  name="unidades"
                  class="entrada"
                  type="number"
                  min="1"
                  max="999"
                  required
                  [(ngModel)]="unidadesEntrada"
                />
              </div>
            </div>
            <div class="acciones">
              <button type="submit" class="boton boton--primario" [disabled]="ajustando()">
                Guardar entrada
              </button>
              <button
                type="button"
                class="boton boton--secundario"
                (click)="entradaAbierta.set(false)"
              >
                Cancelar
              </button>
            </div>
          </form>
        }

        @if (error()) {
          <p class="ayuda-error" role="alert">{{ error() }}</p>
        }

        <div class="acciones">
          @if (conflicto(); as conflicto) {
            @if (conflicto.tipo === 'LOTE_VENCIDO') {
              @if (conflicto.sugerido; as sugerido) {
                <button
                  type="button"
                  class="boton boton--primario"
                  [disabled]="ajustando()"
                  (click)="usarLote(conflicto, sugerido.id)"
                >
                  Cambiar al lote {{ sugerido.codigo }}
                </button>
              }
              <button type="button" class="boton boton--secundario" (click)="volverAtencion()">
                Volver a la atención
              </button>
            } @else if (!entradaAbierta()) {
              @if (conflicto.loteId) {
                <button
                  type="button"
                  class="boton boton--primario"
                  (click)="abrirEntrada(conflicto)"
                >
                  Registrar entrada de inventario
                </button>
              }
              @if (conflicto.disponible > 0) {
                <button
                  type="button"
                  class="boton boton--secundario"
                  [disabled]="ajustando()"
                  (click)="ajustarCantidad(conflicto)"
                >
                  Ajustar cantidad
                </button>
              }
            }
          } @else {
            <button
              type="button"
              class="boton boton--primario"
              [disabled]="cuenta.bloqueada || ajustando()"
              (click)="registrarPago()"
            >
              Registrar pago
            </button>
            <button type="button" class="boton boton--secundario" (click)="volverAtencion()">
              Volver a la atención
            </button>
          }
        </div>
      } @else if (error()) {
        <p class="ayuda-error" role="alert">{{ error() }}</p>
      }
    </main>
  `,
  styles: `
    .tabla-contenedor {
      overflow-x: auto;
    }
    .tabla td {
      font-size: var(--texto-cuerpo);
    }
    .tabla td:nth-child(n + 2) {
      white-space: nowrap;
    }
    .selector {
      appearance: none;
      min-width: 74px;
      padding: 5px 34px 5px 11px;
      background: var(--color-superficie) url('/iconos/flecha-abajo.svg') no-repeat right 9px
        center / 15px;
      border: 1.5px solid var(--color-primario);
      border-radius: 7px;
      color: var(--color-marino);
      font: inherit;
      font-size: var(--texto-cuerpo);
      font-weight: 500;
      cursor: pointer;
      &:focus-visible {
        outline: 3px solid var(--color-primario-suave);
      }
    }
    .total {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .total__valor {
      color: var(--color-marino);
      font-size: 24px;
      font-weight: 700;
    }
    .total__nota {
      font-size: var(--texto-meta);
    }
  `,
})
export default class CuentaCobro {
  /** Llega desde la ruta /personal/facturacion/:consultaId. */
  readonly consultaId = input.required<string>();

  private readonly facturacion = inject(FacturacionService);
  private readonly router = inject(Router);
  private readonly locale = inject(LOCALE_ID);

  protected readonly cuenta = signal<CuentaDeCobro | null>(null);
  protected readonly conflicto = signal<Conflicto | null>(null);
  protected readonly ajustando = signal(false);
  protected readonly entradaAbierta = signal(false);
  protected readonly error = signal<string | null>(null);
  protected unidadesEntrada = 1;

  protected readonly rutaRegistro = computed(
    () => `/personal/consultas/${this.consultaId()}/registro`,
  );
  protected readonly subtitulo = computed(() => {
    const cuenta = this.cuenta();
    if (!cuenta) {
      return null;
    }
    const fecha = formatDate(cuenta.fecha_atencion, 'dd/MM/yyyy', this.locale);
    return `Atención ${fecha} · ${cuenta.servicio_principal ?? 'Consulta'}`;
  });

  constructor() {
    effect(() => this.cargar(this.consultaId()));
  }

  protected cantidades(linea: LineaCuenta): number[] {
    const tope = Math.max(10, linea.cantidad);
    return Array.from({ length: tope }, (_, i) => i + 1);
  }

  protected ajustar(linea: LineaCuenta, cambios: { lote_id?: string; cantidad?: number }): void {
    this.enviarAjuste(linea.id, cambios, linea);
  }

  protected usarLote(conflicto: Conflicto, idLote: string): void {
    this.enviarAjuste(conflicto.lineaId, { lote_id: idLote, cantidad: conflicto.cantidad });
  }

  protected ajustarCantidad(conflicto: Conflicto): void {
    this.enviarAjuste(conflicto.lineaId, {
      cantidad: conflicto.disponible,
      ...(conflicto.loteId ? { lote_id: conflicto.loteId } : {}),
    });
  }

  protected abrirEntrada(conflicto: Conflicto): void {
    this.unidadesEntrada = Math.max(conflicto.cantidad - conflicto.disponible, 1);
    this.entradaAbierta.set(true);
  }

  protected registrarEntrada(conflicto: Conflicto): void {
    if (!conflicto.loteId) {
      return;
    }
    this.ajustando.set(true);
    this.facturacion.registrarEntrada(conflicto.loteId, Number(this.unidadesEntrada)).subscribe({
      next: () => {
        this.entradaAbierta.set(false);
        // Con la entrada registrada se vuelve a intentar la cantidad que pedía la atención.
        this.enviarAjuste(conflicto.lineaId, {
          lote_id: conflicto.loteId!,
          cantidad: conflicto.cantidad,
        });
      },
      error: (error: unknown) => {
        this.ajustando.set(false);
        this.error.set(leerErrorApi(error).mensaje);
      },
    });
  }

  protected registrarPago(): void {
    this.router.navigate(['/personal/facturacion', this.consultaId(), 'pago']);
  }

  protected volverAtencion(): void {
    this.router.navigateByUrl(this.rutaRegistro());
  }

  private cargar(idConsulta: string): void {
    this.facturacion.cuenta(idConsulta).subscribe({
      next: (cuenta) => {
        if (cuenta.factura) {
          this.router.navigate(['/personal/facturacion', idConsulta, 'comprobante'], {
            replaceUrl: true,
          });
          return;
        }
        this.mostrar(cuenta);
      },
      error: (error: unknown) => this.error.set(leerErrorApi(error).mensaje),
    });
  }

  private mostrar(cuenta: CuentaDeCobro): void {
    this.cuenta.set(cuenta);
    this.conflicto.set(this.conflictoDeLaCuenta(cuenta));
  }

  private enviarAjuste(
    idLinea: string,
    cambios: { lote_id?: string; cantidad?: number },
    linea?: LineaCuenta,
  ): void {
    this.ajustando.set(true);
    this.error.set(null);
    this.facturacion.ajustarLinea(this.consultaId(), idLinea, cambios).subscribe({
      next: (cuenta) => {
        this.ajustando.set(false);
        this.mostrar(cuenta);
      },
      error: (respuesta: unknown) => {
        this.ajustando.set(false);
        const error = leerErrorApi(respuesta);
        const conflicto = this.conflictoDelError(error, idLinea, linea);
        if (conflicto) {
          this.conflicto.set(conflicto);
        } else {
          this.error.set(error.mensaje);
          this.cargar(this.consultaId());
        }
      },
    });
  }

  /** La API rechazó el cambio (D1 o D2): se muestra lo que se intentó y por qué no procede. */
  private conflictoDelError(
    error: ErrorApi,
    idLinea: string,
    linea?: LineaCuenta,
  ): Conflicto | null {
    if (error.codigo !== 'LOTE_VENCIDO' && error.codigo !== 'EXISTENCIA_INSUFICIENTE') {
      return null;
    }
    const detalle = error.detalle as unknown as DetalleConflicto;
    const sugerido = detalle.lote_sugerido;
    return {
      tipo: error.codigo,
      lineaId: idLinea,
      mensaje: error.mensaje,
      loteId: detalle.lote_id ?? null,
      loteCodigo: detalle.lote,
      loteVence: detalle.fecha_vencimiento ?? null,
      cantidad: detalle.solicitado ?? detalle.cantidad ?? linea?.cantidad ?? 1,
      disponible: detalle.disponible ?? 0,
      sugerido: sugerido ? { id: sugerido.id, codigo: sugerido.codigo } : null,
    };
  }

  /** La cuenta puede llegar bloqueada sin que nadie la toque (por ejemplo, se prescribió más de lo que hay). */
  private conflictoDeLaCuenta(cuenta: CuentaDeCobro): Conflicto | null {
    const linea = cuenta.lineas.find((l) =>
      ['VENCIDO', 'INSUFICIENTE', 'SIN_LOTE'].includes(l.estado),
    );
    if (!linea) {
      return null;
    }
    const disponible = linea.disponible ?? 0;
    if (linea.estado === 'VENCIDO') {
      const sugerido =
        linea.lotes.find((l) => !l.vencido && l.disponible >= linea.cantidad) ??
        linea.lotes.find((l) => !l.vencido) ??
        null;
      const vence = linea.lote_vence ? formatDate(linea.lote_vence, 'dd/MM/yyyy', this.locale) : '';
      return {
        tipo: 'LOTE_VENCIDO',
        lineaId: linea.id,
        mensaje:
          `El lote ${linea.lote_codigo} de ${linea.descripcion} venció el ${vence} y no puede ` +
          'dispensarse ni facturarse. Usa el lote vigente con vencimiento más próximo.',
        loteId: linea.lote_id,
        loteCodigo: linea.lote_codigo,
        loteVence: linea.lote_vence,
        cantidad: linea.cantidad,
        disponible,
        sugerido: sugerido ? { id: sugerido.id, codigo: sugerido.codigo } : null,
      };
    }
    return {
      tipo: 'EXISTENCIA_INSUFICIENTE',
      lineaId: linea.id,
      mensaje:
        `Solo hay ${disponible} unidades disponibles de ${linea.descripcion} y la atención usó ` +
        `${linea.cantidad}. No se puede facturar más de lo que hay en inventario.`,
      loteId: linea.lote_id,
      loteCodigo: linea.lote_codigo,
      loteVence: linea.lote_vence,
      cantidad: linea.cantidad,
      disponible,
      sugerido: null,
    };
  }
}
