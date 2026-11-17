import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { leerErrorApi } from '../../../core/api/error-api';
import { SesionService } from '../../../core/autenticacion/sesion.service';
import { Encabezado } from '../../../compartido/encabezado/encabezado';
import { EstadoEtiqueta } from '../../../compartido/estado-etiqueta/estado-etiqueta';
import { TarjetaPaciente } from '../../../compartido/tarjeta-paciente/tarjeta-paciente';
import { AtencionService } from '../atencion.service';
import { AtencionFicha, FichaPaciente as Ficha } from '../modelos';

const ATENCIONES_VISIBLES = 3;

/** M2.2 Ficha consolidada del paciente. */
@Component({
  selector: 'cv-ficha-paciente',
  imports: [DatePipe, RouterLink, Encabezado, EstadoEtiqueta, TarjetaPaciente],
  template: `
    <cv-encabezado titulo="Ficha del paciente" rutaAtras="/personal/pacientes" />
    <main class="contenido">
      @if (ficha(); as ficha) {
        <cv-tarjeta-paciente [paciente]="ficha" />

        <div class="resumen">
          <section class="tarjeta resumen__bloque" aria-labelledby="titulo-vacunas">
            <h3 id="titulo-vacunas" class="resumen__titulo">Esquema de vacunación</h3>
            @for (vacuna of ficha.vacunas; track vacuna.biologico) {
              <div class="resumen__item">
                <p class="resumen__principal">
                  {{ vacuna.biologico }} · {{ vacuna.fecha_aplicacion | date: 'dd/MM/yyyy' }}
                </p>
                @if (vacuna.fecha_proxima_dosis) {
                  <p class="resumen__secundario">
                    Próxima dosis: {{ vacuna.fecha_proxima_dosis | date: 'dd/MM/yyyy' }}
                  </p>
                  @if (vacuna.refuerzo_programado) {
                    <cv-estado-etiqueta tipo="info">Refuerzo programado</cv-estado-etiqueta>
                  } @else {
                    <cv-estado-etiqueta tipo="advertencia">Refuerzo vencido</cv-estado-etiqueta>
                  }
                }
              </div>
            } @empty {
              <p class="resumen__secundario">Sin vacunas registradas.</p>
            }
          </section>

          <section class="tarjeta resumen__bloque" aria-labelledby="titulo-atenciones">
            <h3 id="titulo-atenciones" class="resumen__titulo">Últimas atenciones</h3>
            @for (atencion of atencionesVisibles(); track atencion.id) {
              <a class="resumen__item resumen__enlace" [routerLink]="rutaAtencion(atencion)">
                <p class="resumen__principal">
                  {{ atencion.fecha | date: 'dd/MM/yyyy' }} · {{ atencion.motivo }}
                </p>
                <p class="resumen__secundario">
                  Atendió: {{ atencion.veterinario }}
                  @if (atencion.estado === 'ABIERTA') {
                    · en curso
                  }
                </p>
              </a>
            } @empty {
              <p class="resumen__secundario">Todavía no tiene atenciones.</p>
            }
          </section>
        </div>

        @if (error()) {
          <p class="ayuda-error" role="alert">{{ error() }}</p>
        }

        <div class="acciones">
          @if (puedeAtender()) {
            <button
              type="button"
              class="boton boton--primario"
              [disabled]="abriendo()"
              (click)="registrarConsulta(ficha)"
            >
              {{ ficha.consulta_abierta_id ? 'Continuar consulta' : 'Registrar consulta' }}
            </button>
          }
          <button
            type="button"
            class="boton boton--secundario"
            [attr.aria-expanded]="verTodo()"
            aria-controls="titulo-atenciones"
            (click)="verTodo.set(!verTodo())"
          >
            {{ verTodo() ? 'Ver solo las últimas' : 'Ver historia completa' }}
          </button>
        </div>
      } @else if (error()) {
        <p class="ayuda-error" role="alert">{{ error() }}</p>
      }
    </main>
  `,
  styles: `
    .resumen {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
      align-items: start;
    }
    .resumen__bloque {
      gap: 11px;
      padding: 22px;
    }
    .resumen__titulo {
      color: var(--color-primario);
      font-size: 22px;
      font-weight: 600;
    }
    .resumen__item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    .resumen__item + .resumen__item {
      padding-top: 11px;
      border-top: 1px solid var(--color-borde);
    }
    .resumen__enlace {
      color: inherit;
      text-decoration: none;
      &:hover .resumen__principal {
        text-decoration: underline;
      }
    }
    .resumen__principal {
      font-weight: 500;
    }
    .resumen__secundario {
      color: var(--color-texto-suave);
      font-size: var(--texto-meta);
    }
  `,
})
export default class FichaPaciente {
  /** Llega desde la ruta /personal/pacientes/:mascotaId. */
  readonly mascotaId = input.required<string>();

  private readonly atencion = inject(AtencionService);
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);

  protected readonly ficha = signal<Ficha | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly abriendo = signal(false);
  protected readonly verTodo = signal(false);

  protected readonly puedeAtender = computed(() => this.sesion.usuario()?.rol === 'VETERINARIO');
  protected readonly atencionesVisibles = computed(() => {
    const atenciones = this.ficha()?.atenciones ?? [];
    return this.verTodo() ? atenciones : atenciones.slice(0, ATENCIONES_VISIBLES);
  });

  constructor() {
    effect(() => {
      this.atencion.ficha(this.mascotaId()).subscribe({
        next: (ficha) => this.ficha.set(ficha),
        error: (error: unknown) => this.error.set(leerErrorApi(error).mensaje),
      });
    });
  }

  protected rutaAtencion(atencion: AtencionFicha): string[] {
    return atencion.estado === 'ABIERTA'
      ? ['/personal/consultas', atencion.id]
      : ['/personal/consultas', atencion.id, 'registro'];
  }

  protected registrarConsulta(ficha: Ficha): void {
    this.abriendo.set(true);
    this.error.set(null);
    this.atencion.iniciarConsulta(ficha.id).subscribe({
      next: (consulta) => this.router.navigate(['/personal/consultas', consulta.id]),
      error: (error: unknown) => {
        this.error.set(leerErrorApi(error).mensaje);
        this.abriendo.set(false);
      },
    });
  }
}
