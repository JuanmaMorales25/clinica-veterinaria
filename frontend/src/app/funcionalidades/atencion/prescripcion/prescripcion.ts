import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { leerErrorApi } from '../../../core/api/error-api';
import { Dialogo } from '../../../compartido/dialogo/dialogo';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { EstadoEtiqueta } from '../../../compartido/estado-etiqueta/estado-etiqueta';
import { TarjetaPaciente } from '../../../compartido/tarjeta-paciente/tarjeta-paciente';
import { AtencionService } from '../atencion.service';
import { ConsultaDetalle, Medicamento } from '../modelos';

type Revision = 'PENDIENTE' | 'REVISADA' | 'OMITIDA' | 'NO_APLICA';
type PasoDialogo = 'alerta' | 'omitir' | null;

const VIAS = ['Oral', 'Subcutánea', 'Intramuscular', 'Intravenosa', 'Tópica', 'Oftálmica', 'Ótica'];

/**
 * M2.4 Prescripción. Si la mascota tiene alergias, el formulario queda bloqueado hasta revisar
 * la alerta (C1) u omitirla con un motivo que queda en la auditoría (C2).
 */
@Component({
  selector: 'cv-prescripcion',
  imports: [FormsModule, Dialogo, Encabezado, EstadoEtiqueta, TarjetaPaciente],
  template: `
    <cv-encabezado titulo="Prescripción" [conAtras]="false" />
    <main class="contenido">
      @if (consulta(); as consulta) {
        <cv-tarjeta-paciente [paciente]="consulta.mascota" />

        <form class="tarjeta" (ngSubmit)="guardar()">
          <div class="tarjeta__encabezado">
            <h3 class="tarjeta__titulo">Prescripción</h3>
            @switch (revision()) {
              @case ('PENDIENTE') {
                <cv-estado-etiqueta tipo="neutro"
                  >Bloqueada hasta revisar la alergia</cv-estado-etiqueta
                >
              }
              @case ('REVISADA') {
                <cv-estado-etiqueta tipo="exito">Alergia revisada</cv-estado-etiqueta>
              }
              @case ('OMITIDA') {
                <cv-estado-etiqueta tipo="advertencia" icono="iconos/advertencia-ambar.svg">
                  Alerta omitida con motivo
                </cv-estado-etiqueta>
              }
            }
          </div>

          <fieldset class="campos" [disabled]="bloqueada()">
            <legend class="solo-lectores">Datos de la prescripción</legend>
            <div class="fila-campos">
              <div class="campo">
                <label for="medicamento">Medicamento (catálogo)</label>
                <select
                  id="medicamento"
                  name="medicamento"
                  class="entrada"
                  required
                  [class.entrada--solo-lectura]="bloqueada()"
                  [(ngModel)]="productoId"
                >
                  <option value="" disabled>Selecciona del inventario</option>
                  @for (medicamento of medicamentos(); track medicamento.id) {
                    <option [value]="medicamento.id">{{ medicamento.nombre }}</option>
                  }
                </select>
              </div>
              <div class="campo">
                <label for="dosis">Dosis</label>
                <input
                  id="dosis"
                  name="dosis"
                  class="entrada"
                  placeholder="Ej.: 10 mg/kg"
                  maxlength="60"
                  [class.entrada--solo-lectura]="bloqueada()"
                  [(ngModel)]="dosis"
                />
              </div>
              <div class="campo">
                <label for="via">Vía de administración</label>
                <select
                  id="via"
                  name="via"
                  class="entrada"
                  [class.entrada--solo-lectura]="bloqueada()"
                  [(ngModel)]="via"
                >
                  @for (opcion of vias; track opcion) {
                    <option [value]="opcion">{{ opcion }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="fila-campos">
              <div class="campo">
                <label for="frecuencia">Frecuencia</label>
                <input
                  id="frecuencia"
                  name="frecuencia"
                  class="entrada"
                  placeholder="Cada 12 horas"
                  maxlength="60"
                  [class.entrada--solo-lectura]="bloqueada()"
                  [(ngModel)]="frecuencia"
                />
              </div>
              <div class="campo">
                <label for="duracion">Duración</label>
                <input
                  id="duracion"
                  name="duracion"
                  class="entrada"
                  placeholder="7 días"
                  maxlength="60"
                  [class.entrada--solo-lectura]="bloqueada()"
                  [(ngModel)]="duracion"
                />
              </div>
              <div class="campo">
                <label for="cantidad">Cantidad (unidades)</label>
                <input
                  id="cantidad"
                  name="cantidad"
                  class="entrada"
                  type="number"
                  min="1"
                  max="99"
                  [class.entrada--solo-lectura]="bloqueada()"
                  [(ngModel)]="cantidad"
                />
              </div>
            </div>
          </fieldset>

          @if (error()) {
            <p class="ayuda-error" role="alert">{{ error() }}</p>
          }
        </form>

        <div class="acciones">
          <button
            type="button"
            class="boton boton--primario"
            [disabled]="bloqueada() || guardando()"
            (click)="guardar()"
          >
            Guardar prescripción
          </button>
          <button type="button" class="boton boton--secundario" (click)="volver()">Cancelar</button>
        </div>

        <cv-dialogo
          tono="alerta"
          idTitulo="titulo-dialogo-alergia"
          [abierto]="paso() !== null"
          (cerrar)="paso() === 'omitir' ? paso.set('alerta') : volver()"
        >
          @if (paso() === 'alerta') {
            <div class="dialogo__cabecera">
              <img src="iconos/advertencia-grande.svg" alt="" width="44" height="44" />
              @for (alergia of consulta.mascota.alergias; track alergia.descripcion) {
                <cv-estado-etiqueta tipo="alerta"
                  >ALERGIA: {{ alergia.descripcion }}</cv-estado-etiqueta
                >
              }
            </div>
            <h2 id="titulo-dialogo-alergia" class="dialogo__titulo">
              Revisa la alergia antes de prescribir
            </h2>
            <p class="dialogo__texto">
              {{ consulta.mascota.nombre }} tiene registrada alergia a {{ alergiasEnTexto() }}.
              Confirma que revisaste este antecedente para habilitar la prescripción.
            </p>
            <div class="acciones">
              <button
                type="button"
                class="boton boton--primario"
                [disabled]="registrando()"
                (click)="decidir('REVISADA')"
              >
                Revisé la alergia — continuar
              </button>
              <button type="button" class="boton boton--secundario" (click)="paso.set('omitir')">
                Omitir alerta
              </button>
            </div>
          } @else if (paso() === 'omitir') {
            @for (alergia of consulta.mascota.alergias; track alergia.descripcion) {
              <cv-estado-etiqueta tipo="alerta"
                >ALERGIA: {{ alergia.descripcion }}</cv-estado-etiqueta
              >
            }
            <h2 id="titulo-dialogo-alergia" class="dialogo__titulo">Omitir alerta clínica</h2>
            <p class="dialogo__texto">
              Si continúas sin revisar la alergia, quedará registrado quién omitió la alerta, cuándo
              y por qué motivo.
            </p>
            <div class="campo">
              <label for="motivo-omision">Motivo de la omisión (obligatorio)</label>
              <textarea
                id="motivo-omision"
                name="motivo-omision"
                class="entrada entrada--destacada"
                rows="3"
                placeholder="Escribe el motivo…"
                [(ngModel)]="motivoOmision"
              ></textarea>
              <p class="ayuda">
                <img src="iconos/info.svg" alt="" width="20" height="20" />
                Se registrará tu usuario, la fecha y la hora.
              </p>
            </div>
            @if (errorDialogo()) {
              <p class="ayuda-error" role="alert">{{ errorDialogo() }}</p>
            }
            <div class="acciones">
              <button
                type="button"
                class="boton boton--primario"
                [disabled]="!motivoOmision.trim() || registrando()"
                (click)="decidir('OMITIDA')"
              >
                Omitir y registrar
              </button>
              <button type="button" class="boton boton--secundario" (click)="paso.set('alerta')">
                Volver a la alerta
              </button>
            </div>
          }
        </cv-dialogo>
      } @else if (error()) {
        <p class="ayuda-error" role="alert">{{ error() }}</p>
      }
    </main>
  `,
  styles: `
    .campos {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin: 0;
      padding: 0;
      border: 0;
    }
    .dialogo__cabecera {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 14px;
    }
    .dialogo__titulo {
      color: var(--color-marino);
      font-size: var(--texto-titulo);
      font-weight: 600;
    }
    .dialogo__texto {
      font-size: 19px;
    }
  `,
})
export default class Prescripcion {
  /** Llega desde la ruta /personal/consultas/:consultaId/prescripcion. */
  readonly consultaId = input.required<string>();

  private readonly atencion = inject(AtencionService);
  private readonly router = inject(Router);

  protected readonly vias = VIAS;
  protected readonly consulta = signal<ConsultaDetalle | null>(null);
  protected readonly medicamentos = signal<Medicamento[]>([]);
  protected readonly revision = signal<Revision>('NO_APLICA');
  protected readonly paso = signal<PasoDialogo>(null);
  protected readonly guardando = signal(false);
  protected readonly registrando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errorDialogo = signal<string | null>(null);
  protected readonly bloqueada = computed(() => this.revision() === 'PENDIENTE');
  protected readonly alergiasEnTexto = computed(() =>
    (this.consulta()?.mascota.alergias ?? []).map((a) => a.descripcion.toLowerCase()).join(', '),
  );

  protected productoId = '';
  protected dosis = '';
  protected via = VIAS[0];
  protected frecuencia = '';
  protected duracion = '';
  protected cantidad = 1;
  protected motivoOmision = '';

  constructor() {
    effect(() => {
      const id = this.consultaId();
      this.atencion.consulta(id).subscribe({
        next: (consulta) => {
          if (consulta.estado === 'CERRADA') {
            this.router.navigate(['/personal/consultas', id, 'registro'], { replaceUrl: true });
            return;
          }
          this.consulta.set(consulta);
          if (consulta.mascota.alergias.length) {
            this.revision.set('PENDIENTE');
            this.paso.set('alerta');
          }
        },
        error: (error: unknown) => this.error.set(leerErrorApi(error).mensaje),
      });
    });
    this.atencion.medicamentos().subscribe((medicamentos) => this.medicamentos.set(medicamentos));
  }

  protected decidir(decision: 'REVISADA' | 'OMITIDA'): void {
    const motivo = decision === 'OMITIDA' ? this.motivoOmision.trim() : null;
    this.registrando.set(true);
    this.errorDialogo.set(null);
    this.atencion.registrarAlerta(this.consultaId(), decision, motivo).subscribe({
      next: () => {
        this.revision.set(decision);
        this.paso.set(null);
        this.registrando.set(false);
      },
      error: (error: unknown) => {
        this.errorDialogo.set(leerErrorApi(error).mensaje);
        this.registrando.set(false);
      },
    });
  }

  protected guardar(): void {
    if (!this.productoId) {
      this.error.set('Selecciona el medicamento del inventario.');
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    this.atencion
      .prescribir(this.consultaId(), {
        producto_id: this.productoId,
        cantidad: Number(this.cantidad) || 1,
        dosis: this.dosis.trim() || null,
        via_administracion: this.via,
        frecuencia: this.frecuencia.trim() || null,
        duracion: this.duracion.trim() || null,
        alerta_revisada: this.revision() === 'REVISADA',
        motivo_omision_alerta: this.revision() === 'OMITIDA' ? this.motivoOmision.trim() : null,
      })
      .subscribe({
        next: () => this.volver(),
        error: (respuesta: unknown) => {
          this.guardando.set(false);
          const error = leerErrorApi(respuesta);
          if (error.codigo === 'ALERGIA_SIN_REVISAR') {
            this.revision.set('PENDIENTE');
            this.paso.set('alerta');
          } else {
            this.error.set(error.mensaje);
          }
        },
      });
  }

  protected volver(): void {
    this.router.navigate(['/personal/consultas', this.consultaId()]);
  }
}
