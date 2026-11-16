import { CurrencyPipe, formatDate } from '@angular/common';
import { Component, LOCALE_ID, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { leerErrorApi } from '../../../core/api/error-api';
import { escucharTeclaDemo } from '../../../core/demo/demo.service';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { EstadoEtiqueta } from '../../../compartido/estado-etiqueta/estado-etiqueta';
import { TarjetaPaciente } from '../../../compartido/tarjeta-paciente/tarjeta-paciente';
import { FacturacionService } from '../facturacion.service';
import { CuentaDeCobro, MedioPago } from '../modelos';

const MEDIOS: { valor: MedioPago; etiqueta: string }[] = [
  { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
  { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia' },
  { valor: 'TARJETA', etiqueta: 'Tarjeta' },
];

const ETIQUETAS_REVERSA: Record<string, string> = {
  historia_clinica: 'Historia clínica',
  inventario: 'Inventario',
  factura: 'Factura',
};

function aPesos(texto: string): number | null {
  const digitos = texto.replace(/\D/g, '');
  return digitos ? Number(digitos) : null;
}

/**
 * M3.2 Registrar pago. "Generar cuenta y comprobante" llama a CierreAtencionFacade, que guarda
 * inventario y factura en una sola transacción; si falla, se muestra la reversa total (D3).
 */
@Component({
  selector: 'cv-registrar-pago',
  imports: [CurrencyPipe, FormsModule, Encabezado, EstadoEtiqueta, TarjetaPaciente],
  template: `
    <cv-encabezado titulo="Registrar pago" [conAtras]="false" />
    <main class="contenido">
      @if (falla(); as falla) {
        <section class="tarjeta falla" aria-labelledby="titulo-falla">
          <cv-estado-etiqueta tipo="advertencia" icono="iconos/advertencia-ambar.svg">
            Cuenta de cobro no generada
          </cv-estado-etiqueta>
          <h2 id="titulo-falla" class="falla__titulo">No se pudo cerrar la facturación</h2>
          <p class="falla__texto">
            Para proteger tus datos, la operación se canceló completa. No quedó nada a medias.
          </p>
          <ul class="falla__lista">
            @for (parte of falla; track parte.etiqueta) {
              <li>
                <img src="iconos/check.svg" alt="" width="27" height="27" />
                {{ parte.etiqueta }}: {{ parte.estado }}
              </li>
            }
          </ul>
          <div class="falla__acciones">
            <button type="button" class="boton boton--primario" (click)="reintentar()">
              Reintentar
            </button>
            <button type="button" class="boton boton--secundario" (click)="volverAtencion()">
              Volver a la atención
            </button>
          </div>
        </section>
      } @else if (cuenta(); as cuenta) {
        <cv-tarjeta-paciente
          [paciente]="cuenta.paciente"
          variante="compacta"
          [subtitulo]="subtitulo()"
        />

        <form class="tarjeta" (ngSubmit)="pagar(false)">
          <p class="pago__total">
            Total a pagar: {{ cuenta.total | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
          </p>
          <fieldset class="medios">
            <legend class="medios__titulo">Medio de pago</legend>
            <div class="medios__opciones">
              @for (opcion of medios; track opcion.valor) {
                <label class="medio" [class.medio--activo]="medio() === opcion.valor">
                  <input
                    class="solo-lectores"
                    type="radio"
                    name="medio"
                    [value]="opcion.valor"
                    [checked]="medio() === opcion.valor"
                    (change)="medio.set(opcion.valor)"
                  />
                  <img
                    [src]="
                      medio() === opcion.valor
                        ? 'iconos/radio-activo.svg'
                        : 'iconos/radio-inactivo.svg'
                    "
                    alt=""
                    width="18"
                    height="18"
                  />
                  {{ opcion.etiqueta }}
                </label>
              }
            </div>
          </fieldset>

          @if (medio() === 'EFECTIVO') {
            <div class="fila-campos">
              <div class="campo campo--medio">
                <label for="recibido">Valor recibido</label>
                <input
                  id="recibido"
                  name="recibido"
                  class="entrada"
                  inputmode="numeric"
                  autocomplete="off"
                  placeholder="$ 0"
                  [ngModel]="valorTexto()"
                  (ngModelChange)="valorTexto.set($event)"
                  (blur)="formatearValor()"
                />
              </div>
            </div>
            @if (cambio() !== null) {
              <p class="pago__cambio">
                Cambio: {{ cambio() | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
              </p>
            } @else if (valorRecibido() !== null) {
              <p class="ayuda-error">
                Faltan
                {{
                  cuenta.total - (valorRecibido() ?? 0)
                    | currency: 'COP' : 'symbol-narrow' : '1.0-0'
                }}
                para cubrir el total.
              </p>
            }
          }

          @if (error()) {
            <p class="ayuda-error" role="alert">{{ error() }}</p>
          }
        </form>

        <div class="acciones">
          <button
            type="button"
            class="boton boton--primario"
            [disabled]="!puedePagar() || enviando()"
            (click)="pagar(false)"
          >
            Generar cuenta y comprobante
          </button>
          <button type="button" class="boton boton--secundario" (click)="volverCuenta()">
            Volver
          </button>
        </div>
      } @else if (error()) {
        <p class="ayuda-error" role="alert">{{ error() }}</p>
      }
    </main>
  `,
  styles: `
    .pago__total {
      color: var(--color-marino);
      font-size: var(--texto-titulo);
      font-weight: 700;
    }
    .pago__cambio {
      color: var(--color-primario);
      font-size: 22px;
      font-weight: 600;
    }
    .medios {
      margin: 0;
      padding: 0;
      border: 0;
    }
    .medios__titulo {
      margin-bottom: 11px;
      padding: 0;
      font-size: var(--texto-etiqueta);
      font-weight: 500;
    }
    .medios__opciones {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
    }
    .medio {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 15px;
      background: var(--color-superficie);
      border: 1.5px solid var(--color-borde);
      border-radius: 999px;
      font-size: var(--texto-cuerpo);
      font-weight: 500;
      cursor: pointer;
      &:has(input:focus-visible) {
        outline: 3px solid var(--color-primario-suave);
      }
    }
    .medio--activo {
      background: var(--color-primario-suave);
      border: 2px solid var(--color-primario);
    }
    .campo--medio {
      flex: 0 1 calc(50% - 11px);
    }
    .falla {
      align-self: center;
      width: 100%;
      max-width: 598px;
      align-items: flex-start;
      padding: 38px;
    }
    .falla__titulo {
      color: var(--color-marino);
      font-size: var(--texto-titulo);
      font-weight: 600;
    }
    .falla__texto {
      font-size: 19px;
    }
    .falla__lista {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: var(--texto-cuerpo);
      font-weight: 500;
      li {
        display: flex;
        align-items: center;
        gap: 12px;
      }
    }
    .falla__acciones {
      display: flex;
      flex-direction: column;
      gap: 14px;
      width: 100%;
    }
    @media (max-width: 640px) {
      .campo--medio {
        flex-basis: 100%;
      }
      .falla {
        padding: 22px;
      }
    }
  `,
})
export default class RegistrarPago {
  /** Llega desde la ruta /personal/facturacion/:consultaId/pago. */
  readonly consultaId = input.required<string>();

  private readonly facturacion = inject(FacturacionService);
  private readonly router = inject(Router);
  private readonly locale = inject(LOCALE_ID);

  protected readonly medios = MEDIOS;
  protected readonly cuenta = signal<CuentaDeCobro | null>(null);
  protected readonly medio = signal<MedioPago>('EFECTIVO');
  protected readonly valorTexto = signal('');
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly falla = signal<{ etiqueta: string; estado: string }[] | null>(null);

  protected readonly valorRecibido = computed(() => aPesos(this.valorTexto()));
  protected readonly cambio = computed(() => {
    const valor = this.valorRecibido();
    const total = this.cuenta()?.total ?? 0;
    return valor !== null && valor >= total ? valor - total : null;
  });
  protected readonly puedePagar = computed(
    () => this.medio() !== 'EFECTIVO' || this.cambio() !== null,
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
    effect(() => {
      const id = this.consultaId();
      this.facturacion.cuenta(id).subscribe({
        next: (cuenta) => {
          if (cuenta.factura) {
            this.router.navigate(['/personal/facturacion', id, 'comprobante'], {
              replaceUrl: true,
            });
          } else if (cuenta.bloqueada) {
            this.router.navigate(['/personal/facturacion', id], { replaceUrl: true });
          } else {
            this.cuenta.set(cuenta);
          }
        },
        error: (error: unknown) => this.error.set(leerErrorApi(error).mensaje),
      });
    });
    // Tecla 4: la API falla a mitad de la transacción y revierte todo (D3).
    escucharTeclaDemo('4', () => this.pagar(true));
  }

  protected formatearValor(): void {
    const valor = this.valorRecibido();
    if (valor !== null) {
      this.valorTexto.set('$ ' + new Intl.NumberFormat(this.locale).format(valor));
    }
  }

  protected pagar(simularFalla: boolean): void {
    if (!this.puedePagar() || this.enviando()) {
      if (simularFalla && this.medio() === 'EFECTIVO' && this.cambio() === null) {
        this.error.set('Escribe el valor recibido antes de generar la cuenta.');
      }
      return;
    }
    this.enviando.set(true);
    this.error.set(null);
    this.facturacion
      .facturar(this.consultaId(), {
        medio: this.medio(),
        valor_recibido: this.medio() === 'EFECTIVO' ? this.valorRecibido() : null,
        simular_falla: simularFalla,
      })
      .subscribe({
        next: () =>
          this.router.navigate(['/personal/facturacion', this.consultaId(), 'comprobante'], {
            queryParams: { aviso: 'emitida' },
          }),
        error: (respuesta: unknown) => {
          this.enviando.set(false);
          const error = leerErrorApi(respuesta);
          if (error.codigo === 'FALLA_TRANSACCION') {
            this.falla.set(
              Object.entries(error.detalle).map(([clave, estado]) => ({
                etiqueta: ETIQUETAS_REVERSA[clave] ?? clave,
                estado: String(estado),
              })),
            );
          } else if (['LOTE_VENCIDO', 'EXISTENCIA_INSUFICIENTE'].includes(error.codigo)) {
            this.volverCuenta();
          } else {
            this.error.set(error.mensaje);
          }
        },
      });
  }

  protected reintentar(): void {
    this.falla.set(null);
    this.pagar(false);
  }

  protected volverCuenta(): void {
    this.router.navigate(['/personal/facturacion', this.consultaId()]);
  }

  protected volverAtencion(): void {
    this.router.navigate(['/personal/consultas', this.consultaId(), 'registro']);
  }
}
