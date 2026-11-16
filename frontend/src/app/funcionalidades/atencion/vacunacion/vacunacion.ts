import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, of, switchMap } from 'rxjs';

import { leerErrorApi } from '../../../core/api/error-api';
import { Aviso } from '../../../compartido/aviso/aviso';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { TarjetaPaciente } from '../../../compartido/tarjeta-paciente/tarjeta-paciente';
import { AtencionService } from '../atencion.service';
import { hoyIso, sumarDias } from '../formato';
import { ConsultaDetalle, OpcionesVacunacion } from '../modelos';

const SIN_VACUNA = '';

/** M2.5 Registrar vacunación y cerrar la atención. */
@Component({
  selector: 'cv-vacunacion',
  imports: [DatePipe, FormsModule, Aviso, Encabezado, TarjetaPaciente],
  template: `
    <cv-encabezado titulo="Registrar vacunación" [conAtras]="false" />
    <main class="contenido">
      @if (consulta(); as consulta) {
        <cv-tarjeta-paciente [paciente]="consulta.mascota" variante="compacta" />

        <form class="tarjeta" (ngSubmit)="guardarYCerrar()">
          <h3 class="tarjeta__titulo">Vacunación</h3>
          <div class="fila-campos">
            <div class="campo">
              <label for="biologico">Biológico</label>
              <select
                id="biologico"
                name="biologico"
                class="entrada"
                [ngModel]="esquemaId()"
                (ngModelChange)="elegirBiologico($event)"
              >
                <option [value]="sinVacuna">Sin vacuna en esta atención</option>
                @for (opcion of opciones()?.opciones ?? []; track opcion.esquema_id) {
                  <option [value]="opcion.esquema_id">{{ opcion.biologico }}</option>
                }
              </select>
            </div>
            <div class="campo">
              <label for="laboratorio">Laboratorio</label>
              <input
                id="laboratorio"
                class="entrada entrada--solo-lectura"
                readonly
                [value]="opcionElegida()?.laboratorio ?? '—'"
              />
            </div>
          </div>

          @if (opcionElegida(); as opcion) {
            <div class="fila-campos">
              <div class="campo">
                <label for="lote">Lote</label>
                <select
                  id="lote"
                  name="lote"
                  class="entrada"
                  [ngModel]="loteId()"
                  (ngModelChange)="loteId.set($event)"
                >
                  @for (lote of opcion.lotes; track lote.id) {
                    <option [value]="lote.id">
                      {{ lote.codigo }} · vence {{ lote.fecha_vencimiento | date: 'dd/MM/yyyy' }}
                    </option>
                  } @empty {
                    <option value="" disabled>No hay lotes vigentes con existencias</option>
                  }
                </select>
              </div>
              <div class="campo">
                <label for="fecha">Fecha de aplicación</label>
                <input
                  id="fecha"
                  name="fecha"
                  class="entrada"
                  type="date"
                  [max]="hoy"
                  [ngModel]="fechaAplicacion()"
                  (ngModelChange)="fechaAplicacion.set($event)"
                />
              </div>
            </div>
          }

          <div class="fila-campos">
            <div class="campo campo--medio">
              <label for="veterinario">Veterinario responsable</label>
              <input
                id="veterinario"
                class="entrada entrada--solo-lectura"
                readonly
                [value]="consulta.veterinario"
              />
            </div>
          </div>

          @if (proximaDosis(); as proxima) {
            <cv-aviso
              tipo="exito"
              [titulo]="'Próxima dosis calculada: ' + (proxima | date: 'dd/MM/yyyy')"
            >
              <p>
                Según el esquema configurado para la especie. Se avisará al propietario
                {{ opciones()?.dias_aviso }} días antes ({{ fechaAviso() | date: 'dd/MM/yyyy' }}).
              </p>
            </cv-aviso>
          }

          @if (error()) {
            <p class="ayuda-error" role="alert">{{ error() }}</p>
          }
        </form>

        <div class="acciones">
          <button
            type="button"
            class="boton boton--primario"
            [disabled]="guardando() || (opcionElegida() !== null && !loteId())"
            (click)="guardarYCerrar()"
          >
            Guardar y cerrar la atención
          </button>
          <button type="button" class="boton boton--secundario" (click)="volver()">
            Volver a la consulta
          </button>
        </div>
      } @else if (error()) {
        <p class="ayuda-error" role="alert">{{ error() }}</p>
      }
    </main>
  `,
  styles: `
    .campo--medio {
      flex: 0 1 calc(50% - 11px);
    }
    @media (max-width: 640px) {
      .campo--medio {
        flex-basis: 100%;
      }
    }
  `,
})
export default class Vacunacion {
  /** Llega desde la ruta /personal/consultas/:consultaId/vacunacion. */
  readonly consultaId = input.required<string>();

  private readonly atencion = inject(AtencionService);
  private readonly router = inject(Router);

  protected readonly sinVacuna = SIN_VACUNA;
  protected readonly hoy = hoyIso();
  protected readonly consulta = signal<ConsultaDetalle | null>(null);
  protected readonly opciones = signal<OpcionesVacunacion | null>(null);
  protected readonly esquemaId = signal(SIN_VACUNA);
  protected readonly loteId = signal('');
  protected readonly fechaAplicacion = signal(hoyIso());
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly opcionElegida = computed(
    () => this.opciones()?.opciones.find((o) => o.esquema_id === this.esquemaId()) ?? null,
  );
  protected readonly proximaDosis = computed(() => {
    const opcion = this.opcionElegida();
    const fecha = this.fechaAplicacion();
    return opcion && fecha ? sumarDias(fecha, opcion.intervalo_dias) : null;
  });
  protected readonly fechaAviso = computed(() => {
    const proxima = this.proximaDosis();
    return proxima ? sumarDias(proxima, -(this.opciones()?.dias_aviso ?? 0)) : null;
  });

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
          this.atencion.opcionesVacunacion(id).subscribe((opciones) => {
            this.opciones.set(opciones);
            const registrada = consulta.vacunaciones[0];
            if (registrada) {
              this.esquemaId.set(registrada.esquema_id);
              this.loteId.set(registrada.lote_id);
              this.fechaAplicacion.set(registrada.fecha_aplicacion);
            }
          });
        },
        error: (error: unknown) => this.error.set(leerErrorApi(error).mensaje),
      });
    });
  }

  protected elegirBiologico(esquemaId: string): void {
    this.esquemaId.set(esquemaId);
    // FEFO: se propone el lote vigente que vence primero.
    this.loteId.set(this.opcionElegida()?.lotes[0]?.id ?? '');
  }

  protected guardarYCerrar(): void {
    const id = this.consultaId();
    const opcion = this.opcionElegida();
    const vacunar: Observable<unknown> = opcion
      ? this.atencion.registrarVacunacion(id, {
          esquema_id: opcion.esquema_id,
          lote_id: this.loteId(),
          fecha_aplicacion: this.fechaAplicacion() || null,
        })
      : of(null);
    this.guardando.set(true);
    this.error.set(null);
    vacunar.pipe(switchMap(() => this.atencion.cerrar(id))).subscribe({
      next: () =>
        this.router.navigate(['/personal/consultas', id, 'registro'], {
          queryParams: { aviso: 'recien-cerrada' },
        }),
      error: (respuesta: unknown) => {
        this.guardando.set(false);
        const error = leerErrorApi(respuesta);
        this.error.set(
          error.codigo === 'DATOS_INCOMPLETOS'
            ? 'Antes de cerrar, vuelve a la consulta y completa el motivo y el diagnóstico.'
            : error.mensaje,
        );
      },
    });
  }

  protected volver(): void {
    this.router.navigate(['/personal/consultas', this.consultaId()]);
  }
}
