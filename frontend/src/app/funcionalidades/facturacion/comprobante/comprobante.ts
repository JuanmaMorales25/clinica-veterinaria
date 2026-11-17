import { CurrencyPipe, DatePipe, formatDate } from '@angular/common';
import { Component, LOCALE_ID, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { leerErrorApi } from '../../../core/api/error-api';
import { SesionService } from '../../../core/autenticacion/sesion.service';
import { Aviso } from '../../../compartido/aviso/aviso';
import { Dialogo } from '../../../compartido/dialogo/dialogo';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { EstadoEtiqueta } from '../../../compartido/estado-etiqueta/estado-etiqueta';
import { TarjetaPaciente } from '../../../compartido/tarjeta-paciente/tarjeta-paciente';
import { FacturacionService } from '../facturacion.service';
import { Comprobante as DatosComprobante } from '../modelos';

const NOMBRES_ROL: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  VETERINARIO: 'Veterinario(a)',
  AUXILIAR: 'Auxiliar',
};

const NOMBRES_MEDIO: Record<string, string> = {
  EFECTIVO: 'efectivo',
  TRANSFERENCIA: 'transferencia',
  TARJETA: 'tarjeta',
};

/** M3.3 Comprobante emitido y anulación de la factura con motivo (D4). */
@Component({
  selector: 'cv-comprobante',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    Aviso,
    Dialogo,
    Encabezado,
    EstadoEtiqueta,
    TarjetaPaciente,
  ],
  template: `
    <cv-encabezado titulo="Comprobante" rutaAtras="/personal/pacientes" />
    <main class="contenido">
      @if (factura(); as factura) {
        @if (factura.estado === 'ANULADA') {
          <cv-aviso tipo="neutro" [titulo]="'Factura ' + factura.numero + ' anulada'">
            <p>
              Anulada el {{ factura.anulada_en | date: 'dd/MM/yyyy HH:mm' }} por
              {{ factura.anulada_por }}. Motivo: {{ factura.motivo_anulacion }}
            </p>
            <p>Los productos de esta atención volvieron al inventario.</p>
          </cv-aviso>
        } @else if (aviso() === 'emitida') {
          <cv-aviso tipo="exito" [titulo]="'Factura ' + factura.numero + ' emitida'">
            <p>La atención, el inventario y la factura se guardaron en una sola operación.</p>
          </cv-aviso>
        }
        @if (factura.estado === 'EMITIDA' && factura.alertas_stock.length) {
          <cv-aviso
            tipo="advertencia"
            titulo="Stock por debajo del mínimo"
            icono="iconos/advertencia-ambar.svg"
          >
            @for (alerta of factura.alertas_stock; track alerta.producto) {
              <p>
                {{ alerta.producto }}: quedan {{ alerta.disponible }} (mínimo {{ alerta.minimo }}).
              </p>
            }
          </cv-aviso>
        }

        <cv-tarjeta-paciente
          [paciente]="factura.paciente"
          variante="compacta"
          [subtitulo]="subtitulo()"
        />

        <section class="tarjeta" aria-labelledby="titulo-factura">
          <div class="tarjeta__encabezado">
            <h2 id="titulo-factura" class="tarjeta__titulo">Factura {{ factura.numero }}</h2>
            @if (factura.estado === 'ANULADA') {
              <cv-estado-etiqueta tipo="neutro">Anulada</cv-estado-etiqueta>
            } @else {
              <cv-estado-etiqueta tipo="exito">Pago registrado</cv-estado-etiqueta>
            }
          </div>
          <p class="factura__total">
            Total: {{ factura.total | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
          </p>
          <p class="texto-suave">{{ lineaPago() }}</p>
        </section>

        @if (mensaje()) {
          <p class="ayuda" role="status">
            <img src="iconos/info.svg" alt="" width="20" height="20" />
            {{ mensaje() }}
          </p>
        }
        @if (error()) {
          <p class="ayuda-error" role="alert">{{ error() }}</p>
        }

        <div class="acciones">
          <button
            type="button"
            class="boton boton--primario"
            [disabled]="descargando()"
            (click)="descargar(factura)"
          >
            Descargar comprobante PDF
          </button>
          <button
            type="button"
            class="boton boton--secundario"
            [disabled]="enviando()"
            (click)="enviar(factura)"
          >
            Enviar al correo
          </button>
        </div>
        <div class="acciones">
          @if (factura.estado === 'EMITIDA') {
            <button type="button" class="boton boton--secundario" (click)="abrirAnulacion()">
              Anular factura
            </button>
          }
          <button type="button" class="boton boton--secundario" (click)="volverAlPanel()">
            Volver al panel
          </button>
        </div>

        <cv-dialogo idTitulo="titulo-anular" [abierto]="anulando()" (cerrar)="anulando.set(false)">
          <h2 id="titulo-anular" class="dialogo__titulo">Anular factura {{ factura.numero }}</h2>
          <p class="dialogo__texto">
            La anulación no se puede deshacer. Se reversarán los movimientos de inventario asociados
            y quedará registrada en la auditoría.
          </p>
          <div class="campo">
            <label for="motivo-anulacion">Motivo de la anulación (obligatorio)</label>
            <textarea
              id="motivo-anulacion"
              name="motivo-anulacion"
              class="entrada entrada--destacada"
              rows="3"
              placeholder="Escribe el motivo…"
              [(ngModel)]="motivo"
            ></textarea>
          </div>
          <div class="campo">
            <label for="responsable">Responsable</label>
            <input id="responsable" class="entrada" readonly [value]="responsable()" />
          </div>
          @if (!esAdministrador()) {
            <p class="ayuda-error">Solo un administrador puede anular facturas.</p>
          }
          <div class="dialogo__estado">
            <span>Estado después de anular:</span>
            <cv-estado-etiqueta tipo="neutro">Anulada</cv-estado-etiqueta>
          </div>
          @if (errorAnulacion()) {
            <p class="ayuda-error" role="alert">{{ errorAnulacion() }}</p>
          }
          <div class="acciones">
            <button
              type="button"
              class="boton boton--primario"
              [disabled]="!esAdministrador() || motivo.trim().length < 5 || guardando()"
              (click)="anular(factura)"
            >
              Anular factura
            </button>
            <button type="button" class="boton boton--secundario" (click)="anulando.set(false)">
              Cancelar
            </button>
          </div>
        </cv-dialogo>
      } @else if (error()) {
        <p class="ayuda-error" role="alert">{{ error() }}</p>
      }
    </main>
  `,
  styles: `
    .factura__total {
      color: var(--color-marino);
      font-size: 23px;
      font-weight: 700;
    }
    .dialogo__titulo {
      color: var(--color-marino);
      font-size: var(--texto-titulo);
      font-weight: 600;
    }
    .dialogo__texto {
      font-size: 19px;
    }
    .dialogo__estado {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 11px;
      font-weight: 500;
    }
  `,
})
export default class Comprobante {
  /** Llega desde la ruta /personal/facturacion/:consultaId/comprobante. */
  readonly consultaId = input.required<string>();
  /** ?aviso=emitida al llegar desde el pago. */
  readonly aviso = input<string | undefined>();

  private readonly facturacion = inject(FacturacionService);
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);
  private readonly locale = inject(LOCALE_ID);

  protected readonly factura = signal<DatosComprobante | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly mensaje = signal<string | null>(null);
  protected readonly descargando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly anulando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorAnulacion = signal<string | null>(null);
  protected motivo = '';

  protected readonly esAdministrador = computed(
    () => this.sesion.usuario()?.rol === 'ADMINISTRADOR',
  );
  protected readonly responsable = computed(() => {
    const usuario = this.sesion.usuario();
    return usuario ? `${NOMBRES_ROL[usuario.rol] ?? usuario.rol} · ${usuario.nombre}` : '';
  });
  protected readonly subtitulo = computed(() => {
    const factura = this.factura();
    if (!factura) {
      return null;
    }
    const fecha = formatDate(factura.fecha_atencion, 'dd/MM/yyyy', this.locale);
    return `Atención ${fecha} · ${factura.servicio_principal ?? 'Consulta'}`;
  });
  protected readonly lineaPago = computed(() => {
    const factura = this.factura();
    if (!factura) {
      return '';
    }
    const formato = (valor: number | null) =>
      new Intl.NumberFormat(this.locale, {
        style: 'currency',
        currency: 'COP',
        currencyDisplay: 'narrowSymbol',
        maximumFractionDigits: 0,
      }).format(valor ?? 0);
    const medio = `Medio de pago: ${NOMBRES_MEDIO[factura.medio ?? ''] ?? '—'}`;
    return factura.medio === 'EFECTIVO'
      ? `${medio} · Recibido: ${formato(factura.valor_recibido)} · Cambio: ${formato(factura.cambio)}`
      : medio;
  });

  constructor() {
    effect(() => {
      this.facturacion.factura(this.consultaId()).subscribe({
        next: (factura) => this.factura.set(factura),
        error: (error: unknown) => this.error.set(leerErrorApi(error).mensaje),
      });
    });
  }

  protected descargar(factura: DatosComprobante): void {
    this.descargando.set(true);
    this.facturacion.pdf(factura.id).subscribe({
      next: (archivo) => {
        const enlace = document.createElement('a');
        enlace.href = URL.createObjectURL(archivo);
        enlace.download = `${factura.numero}.pdf`;
        enlace.click();
        setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
        this.descargando.set(false);
      },
      error: (error: unknown) => {
        this.error.set(leerErrorApi(error).mensaje);
        this.descargando.set(false);
      },
    });
  }

  protected enviar(factura: DatosComprobante): void {
    this.enviando.set(true);
    this.mensaje.set(null);
    this.error.set(null);
    this.facturacion.enviar(factura.id).subscribe({
      next: ({ destinatario }) => {
        this.mensaje.set(`Comprobante enviado a ${destinatario}.`);
        this.enviando.set(false);
      },
      error: (error: unknown) => {
        this.error.set(leerErrorApi(error).mensaje);
        this.enviando.set(false);
      },
    });
  }

  protected abrirAnulacion(): void {
    this.motivo = '';
    this.errorAnulacion.set(null);
    this.anulando.set(true);
  }

  protected anular(factura: DatosComprobante): void {
    this.guardando.set(true);
    this.errorAnulacion.set(null);
    this.facturacion.anular(factura.id, this.motivo.trim()).subscribe({
      next: (anulada) => {
        this.factura.set(anulada);
        this.guardando.set(false);
        this.anulando.set(false);
      },
      error: (error: unknown) => {
        this.errorAnulacion.set(leerErrorApi(error).mensaje);
        this.guardando.set(false);
      },
    });
  }

  protected volverAlPanel(): void {
    this.router.navigateByUrl('/personal/pacientes');
  }
}
